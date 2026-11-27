import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Command, Flags } from "@oclif/core";

import {
	buildPreloadedPlayerStaticPackage,
	type ElementSet,
	parseElementsInput,
	publishDistTag,
	readElementSet,
	readSpeechLocales,
} from "../../utils/pie-packages/preloaded-static.js";
import { createNpmAuthEnvironment } from "@pie-players/pie-players-cli/npm-auth-env";
import { resolveInputPath, resolveMonorepoDir } from "../../utils/monorepo-root.js";

export default class PreloadedPlayerBuildPackage extends Command {
	static override description =
		"Build (and optionally publish) PIE preloaded static package for pie-item-player";

	static override examples = [
		"$ bun run cli pie-packages:preloaded-player-build-package -f configs/preloaded-player/star-0326-ng.json",
		'$ bun run cli pie-packages:preloaded-player-build-package -e "@pie-element/multiple-choice@14.0.8,@pie-element/hotspot@12.1.0"',
	];

	static override flags = {
		elementsFile: Flags.string({
			char: "f",
			description: "Path to elements JSON file",
			exclusive: ["elements"],
		}),
		elements: Flags.string({
			char: "e",
			description: "Comma-separated list of elements (package@version)",
			exclusive: ["elementsFile"],
		}),
		iteration: Flags.integer({
			char: "i",
			description:
				"Iteration number for package versioning (used for version string)",
		}),
		loaderVersion: Flags.string({
			description:
				"Override loader version used in the static package version string (default: pie-item-player version in this repo)",
		}),
		publish: Flags.boolean({
			char: "p",
			description: "Publish package to npm after building",
			default: false,
		}),
		dryRun: Flags.boolean({
			description: "Dry run (build but do not publish)",
			default: false,
		}),
		publishTag: Flags.string({
			description:
				"npm dist-tag for publish. Defaults to the config file's set name, or 'latest' for the config that sets \"latest\": true; a prerelease loader publishes under its prerelease id instead, or '<set>-<id>'.",
		}),
		speechLocales: Flags.string({
			description:
				"Comma-separated speech locales to ship, by SRE locale id. Defaults to the config file's \"speechLocales\", or en.",
		}),
	};

	protected async parseElements(
		elementsFile?: string,
		elements?: string,
	): ReturnType<typeof parseElementsInput> {
		return parseElementsInput(elementsFile, elements);
	}

	protected async resolveElementSet(elementsFile: string): Promise<ElementSet> {
		return readElementSet(elementsFile);
	}

	protected async resolveSpeechLocales(
		elementsFile?: string,
		flag?: string,
	): Promise<string[] | undefined> {
		return readSpeechLocales(elementsFile, flag);
	}

	protected async buildPackage(
		options: Parameters<typeof buildPreloadedPlayerStaticPackage>[0],
	): ReturnType<typeof buildPreloadedPlayerStaticPackage> {
		return buildPreloadedPlayerStaticPackage(options);
	}

	protected publish(outputDir: string, cmd: string, monorepoDir: string) {
		const envPath = join(monorepoDir, ".env");
		const { env, cleanup } = createNpmAuthEnvironment(
			existsSync(envPath) ? envPath : undefined,
		);
		try {
			execSync(cmd, { cwd: outputDir, stdio: "inherit", env });
			return cmd;
		} finally {
			cleanup();
		}
	}

	private buildPublishCommand(distTag: string): string {
		return `npm publish --access public --registry https://registry.npmjs.org/ --tag ${distTag}`;
	}

	public async run(): Promise<void> {
		const { flags } = await this.parse(PreloadedPlayerBuildPackage);

		if (!flags.elementsFile && !flags.elements) {
			this.error("Either -f/--elementsFile or -e/--elements must be specified");
		}
		if (flags.dryRun && !flags.publish) {
			this.error("--dryRun can only be used with --publish");
		}
		if (flags.publish && !flags.elementsFile) {
			this.error("--publish needs -f/--elementsFile: a published build is named after its config file");
		}

		const monorepoDir = resolveMonorepoDir(flags.elementsFile);
		const elementsFile = flags.elementsFile
			? resolveInputPath(flags.elementsFile, monorepoDir)
			: undefined;
		const elements = await this.parseElements(elementsFile, flags.elements);
		const elementsArray = elements.map((e: any) => `${e.package}@${e.version}`);
		const elementSet =
			flags.publish && elementsFile ? await this.resolveElementSet(elementsFile) : undefined;

		// Enable safe iteration selection inside the builder for publishing workflows.
		// If iteration is explicitly set, the builder will use it as-is.
		if (flags.publish && !flags.iteration) {
			process.env.PIE_PRELOADED_PLAYER_AUTO_ITERATION = "true";
		} else {
			delete process.env.PIE_PRELOADED_PLAYER_AUTO_ITERATION;
		}

		const { outputDir, version, loaderVersion } = await this.buildPackage({
			elements: elementsArray,
			elementTags: Object.fromEntries(
				elements.filter((element) => element.tag).map((element) => [element.package, element.tag!]),
			),
			iteration: flags.publish ? flags.iteration : undefined,
			loaderVersion: flags.loaderVersion,
			setName: elementSet?.name,
			monorepoDir,
			publish: flags.publish,
			speechLocales: await this.resolveSpeechLocales(elementsFile, flags.speechLocales),
		});

		this.log(`\n✅ Built: @pie-players/pie-preloaded-player@${version}`);
		this.log(`   Output: ${outputDir}\n`);

		if (elementSet) {
			const cmd = this.buildPublishCommand(flags.publishTag ?? publishDistTag(elementSet, loaderVersion));
			if (flags.dryRun) {
				this.log(`[DRY RUN] Would run: ${cmd}`);
				this.log(`[DRY RUN] In directory: ${outputDir}`);
				return;
			}
			this.publish(outputDir, cmd, monorepoDir);
			this.log("\n✅ Published\n");
		} else {
			this.log("Install locally (example):");
			this.log(`  npm i file:${outputDir}`);
			this.log("");
		}
	}
}
