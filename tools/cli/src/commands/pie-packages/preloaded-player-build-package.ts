import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import { Command, Flags } from "@oclif/core";

import {
	buildPreloadedPlayerStaticPackage,
	parseElementsInput,
} from "../../utils/pie-packages/fixed-static.js";
import { createNpmAuthEnvironment } from "../../utils/npm-auth-env.js";

export default class PreloadedPlayerBuildPackage extends Command {
	static override description =
		"Build (and optionally publish) PIE preloaded static package for pie-item-player";

	static override examples = [
		"$ bun run cli pie-packages:preloaded-player-build-package -f elements.json",
		'$ bun run cli pie-packages:preloaded-player-build-package -e "@pie-element/calculator@1.0.0,@pie-element/ruler@2.0.0"',
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
		overwriteBundle: Flags.boolean({
			description:
				"Force rebuild of bundle even if it exists in cache (adds ?overwrite=true)",
			default: false,
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
		pitsBaseUrl: Flags.string({
			description:
				"Bundle builder base URL (default: https://proxy.pie-api.com)",
		}),
		publishTag: Flags.string({
			description:
				"npm dist-tag for publish. Defaults to 'next' for prerelease versions and npm default for stable versions.",
		}),
	};

	protected async parseElements(
		elementsFile?: string,
		elements?: string,
	): ReturnType<typeof parseElementsInput> {
		return parseElementsInput(elementsFile, elements);
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

	private buildPublishCommand(version: string, publishTag?: string): string {
		const isPreRelease = version.includes("-");
		const resolvedTag = publishTag || (isPreRelease ? "next" : "");
		const tagArgs = resolvedTag ? ` --tag ${resolvedTag}` : "";
		return `npm publish --access public --registry https://registry.npmjs.org/${tagArgs}`;
	}

	private findMonorepoRoot(startDir: string): string | undefined {
		let dir = resolve(startDir);
		while (true) {
			const hasRootPackage = existsSync(join(dir, "package.json"));
			const hasItemPlayer = existsSync(
				join(dir, "packages", "item-player", "package.json"),
			);
			if (hasRootPackage && hasItemPlayer) return dir;
			const parent = dirname(dir);
			if (parent === dir) return undefined;
			dir = parent;
		}
	}

	private resolveMonorepoDir(elementsFile?: string): string {
		const cwd = process.cwd();
		const candidates: string[] = [cwd];
		if (process.env.GITHUB_WORKSPACE) {
			candidates.push(process.env.GITHUB_WORKSPACE);
		}
		if (elementsFile) {
			const start = isAbsolute(elementsFile)
				? dirname(elementsFile)
				: resolve(cwd, dirname(elementsFile));
			candidates.push(start);
		}
		try {
			const gitRoot = execSync("git rev-parse --show-toplevel", {
				cwd,
				stdio: ["ignore", "pipe", "ignore"],
			})
				.toString("utf8")
				.trim();
			if (gitRoot) candidates.push(gitRoot);
		} catch {
			// ignore
		}

		for (const candidate of candidates) {
			const root = this.findMonorepoRoot(candidate);
			if (root) return root;
		}

		this.error(
			`Unable to resolve monorepo root from cwd=${cwd}${elementsFile ? ` elementsFile=${elementsFile}` : ""}`,
		);
	}

	public async run(): Promise<void> {
		const { flags } = await this.parse(PreloadedPlayerBuildPackage);

		if (!flags.elementsFile && !flags.elements) {
			this.error("Either -f/--elementsFile or -e/--elements must be specified");
		}
		if (flags.dryRun && !flags.publish) {
			this.error("--dryRun can only be used with --publish");
		}

		const monorepoDir = this.resolveMonorepoDir(flags.elementsFile);
		const elementsFile = flags.elementsFile
			? isAbsolute(flags.elementsFile)
				? flags.elementsFile
				: existsSync(resolve(process.cwd(), flags.elementsFile))
					? resolve(process.cwd(), flags.elementsFile)
					: resolve(monorepoDir, flags.elementsFile)
			: undefined;
		const elements = await this.parseElements(elementsFile, flags.elements);
		const elementsArray = elements.map((e: any) => `${e.package}@${e.version}`);

		// Enable safe iteration selection inside the builder for publishing workflows.
		// If iteration is explicitly set, the builder will use it as-is.
		if (flags.publish && !flags.iteration) {
			process.env.PIE_PRELOADED_PLAYER_AUTO_ITERATION = "true";
		} else {
			delete process.env.PIE_PRELOADED_PLAYER_AUTO_ITERATION;
		}

		const { outputDir, version } = await this.buildPackage({
			elements: elementsArray,
			iteration: flags.publish ? flags.iteration : undefined,
			loaderVersion: flags.loaderVersion,
			pitsBaseUrl: flags.pitsBaseUrl,
			monorepoDir,
			overwriteBundle: flags.overwriteBundle,
			publish: flags.publish,
		});

		this.log(`\n✅ Built: @pie-players/pie-preloaded-player@${version}`);
		this.log(`   Output: ${outputDir}\n`);

		if (flags.publish) {
			const cmd = this.buildPublishCommand(version, flags.publishTag);
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
