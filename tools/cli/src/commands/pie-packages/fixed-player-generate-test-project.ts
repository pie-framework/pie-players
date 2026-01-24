import { Command, Flags } from "@oclif/core";

import { generateFixedStaticTestProject } from "../../utils/pie-packages/test-project.js";

export default class FixedPlayerGenerateTestProject extends Command {
	static override description =
		"Generate a simple browser test project for a pie-fixed-player-static build (local or published)";

	static override examples = [
		"$ bun run cli pie-packages:fixed-player-generate-test-project --package-path ./local-builds/local",
		"$ bun run cli pie-packages:fixed-player-generate-test-project --published-version latest",
	];

	static override flags = {
		packagePath: Flags.string({
			char: "P",
			description:
				"Path to a built static package directory (must contain dist/)",
			exclusive: ["publishedVersion"],
		}),
		publishedVersion: Flags.string({
			char: "v",
			description:
				'Use published npm package version (e.g., "1.0.0" or "latest")',
			exclusive: ["packagePath"],
		}),
		outputDir: Flags.string({
			char: "o",
			description: "Output directory for the generated test project",
			default: "~/Downloads/pie-tag-test-projects",
		}),
		name: Flags.string({
			char: "n",
			description: "Project name (directory name)",
			default: "pie-fixed-player-static-test",
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

	public async run(): Promise<void> {
		const { flags } = await this.parse(FixedPlayerGenerateTestProject);

		const monorepoDir = process.cwd();

		const projectDir = await generateFixedStaticTestProject({
			monorepoDir,
			outputDir: flags.outputDir,
			name: flags.name,
			packagePath: flags.packagePath,
			publishedVersion: flags.publishedVersion,
			start: flags.start,
			port: flags.port,
		});

		this.log(`\n✅ Generated test project: ${projectDir}\n`);
	}
}
