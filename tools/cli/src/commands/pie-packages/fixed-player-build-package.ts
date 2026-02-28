import { execSync } from "node:child_process";

import { Command, Flags } from "@oclif/core";

import {
	buildFixedPlayerStaticPackage,
	parseElementsInput,
} from "../../utils/pie-packages/fixed-static.js";

export default class FixedPlayerBuildPackage extends Command {
	static override description =
		"Build (and optionally publish) PIE preloaded static package for pie-item-player";

	static override examples = [
		"$ bun run cli pie-packages:fixed-player-build-package -f elements.json",
		'$ bun run cli pie-packages:fixed-player-build-package -e "@pie-element/calculator@1.0.0,@pie-element/ruler@2.0.0"',
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
	};

	public async run(): Promise<void> {
		const { flags } = await this.parse(FixedPlayerBuildPackage);

		if (!flags.elementsFile && !flags.elements) {
			this.error("Either -f/--elementsFile or -e/--elements must be specified");
		}
		if (flags.dryRun && !flags.publish) {
			this.error("--dryRun can only be used with --publish");
		}

		const monorepoDir = process.cwd();

		const elements = await parseElementsInput(
			flags.elementsFile,
			flags.elements,
		);
		const elementsArray = elements.map((e: any) => `${e.package}@${e.version}`);

		// Enable safe iteration selection inside the builder for publishing workflows.
		// If iteration is explicitly set, the builder will use it as-is.
		if (flags.publish && !flags.iteration) {
			process.env.PIE_FIXED_PLAYER_STATIC_AUTO_ITERATION = "true";
		} else {
			delete process.env.PIE_FIXED_PLAYER_STATIC_AUTO_ITERATION;
		}

		const { outputDir, version } = await buildFixedPlayerStaticPackage({
			elements: elementsArray,
			iteration: flags.publish ? flags.iteration : undefined,
			loaderVersion: flags.loaderVersion,
			pitsBaseUrl: flags.pitsBaseUrl,
			monorepoDir,
			overwriteBundle: flags.overwriteBundle,
		});

		this.log(`\n✅ Built: @pie-players/pie-fixed-player-static@${version}`);
		this.log(`   Output: ${outputDir}\n`);

		if (flags.publish) {
			const cmd =
				"npm publish --access public --registry https://registry.npmjs.org/";
			if (flags.dryRun) {
				this.log(`[DRY RUN] Would run: ${cmd}`);
				this.log(`[DRY RUN] In directory: ${outputDir}`);
				return;
			}
			execSync(cmd, { cwd: outputDir, stdio: "inherit" });
			this.log("\n✅ Published\n");
		} else {
			this.log("Install locally (example):");
			this.log(`  npm i file:${outputDir}`);
			this.log("");
		}
	}
}
