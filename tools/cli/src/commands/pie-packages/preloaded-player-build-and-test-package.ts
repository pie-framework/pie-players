import { execSync } from "node:child_process";

import { Command, Flags } from "@oclif/core";

import {
	buildPreloadedPlayerStaticPackage,
	parseElementsInput,
} from "../../utils/pie-packages/fixed-static.js";
import { generatePreloadedStaticTestProject } from "../../utils/pie-packages/test-project.js";

export default class PreloadedPlayerBuildAndTestPackage extends Command {
	static override description =
		"Build a preloaded static package (optionally publish) and optionally generate a browser test project";

	static override examples = [
		"$ bun run cli pie-packages:preloaded-player-build-and-test-package -f configs/preloaded-player/example.json --generateTestProject",
		'$ bun run cli pie-packages:preloaded-player-build-and-test-package -e "@pie-element/multiple-choice@11.4.3" --publish --dry-run',
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

		generateTestProject: Flags.boolean({
			char: "g",
			description: "Generate a browser test project after building",
			default: false,
		}),
		outputDir: Flags.string({
			char: "o",
			description: "Output directory for the generated test project",
			default: "~/Downloads/pie-tag-test-projects",
		}),
		name: Flags.string({
			char: "n",
			description: "Test project name (directory name)",
			default: "pie-item-player-preloaded-static-test",
		}),
		start: Flags.boolean({
			char: "s",
			description:
				"Start a simple static server (python3 http.server) after generation",
			default: false,
		}),
		port: Flags.integer({
			description: "Port for the static server (only used with --start)",
			default: 4173,
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

	protected async generateTestProject(
		options: Parameters<typeof generatePreloadedStaticTestProject>[0],
	): ReturnType<typeof generatePreloadedStaticTestProject> {
		return generatePreloadedStaticTestProject(options);
	}

	protected publish(outputDir: string) {
		const cmd =
			"npm publish --access public --registry https://registry.npmjs.org/";
		execSync(cmd, { cwd: outputDir, stdio: "inherit" });
		return cmd;
	}

	public async run(): Promise<void> {
		const { flags } = await this.parse(PreloadedPlayerBuildAndTestPackage);

		if (!flags.elementsFile && !flags.elements) {
			this.error("Either -f/--elementsFile or -e/--elements must be specified");
		}
		if (flags.dryRun && !flags.publish) {
			this.error("--dryRun can only be used with --publish");
		}

		const monorepoDir = process.cwd();

		const elements = await this.parseElements(flags.elementsFile, flags.elements);
		const elementsArray = elements.map((e: any) => `${e.package}@${e.version}`);

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
		});

		this.log(`\n✅ Built: @pie-players/pie-preloaded-player@${version}`);
		this.log(`   Output: ${outputDir}\n`);

		if (flags.publish) {
			const cmd =
				"npm publish --access public --registry https://registry.npmjs.org/";
			if (flags.dryRun) {
				this.log(`[DRY RUN] Would run: ${cmd}`);
				this.log(`[DRY RUN] In directory: ${outputDir}`);
			} else {
				this.publish(outputDir);
				this.log("\n✅ Published\n");
			}
		}

		if (flags.generateTestProject) {
			const projectDir = await this.generateTestProject({
				monorepoDir,
				outputDir: flags.outputDir,
				name: flags.name,
				packagePath: outputDir,
				start: flags.start,
				port: flags.port,
			});
			this.log(`\n✅ Generated test project: ${projectDir}\n`);
		}
	}
}
