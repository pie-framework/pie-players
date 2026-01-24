import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Command, Flags } from "@oclif/core";

const TAGS = [
	"pie-fixed-player",
	"pie-inline-player",
	"pie-esm-player",
] as const;
type TagName = (typeof TAGS)[number];

function tagToPackageDir(tag: TagName): string {
	switch (tag) {
		case "pie-fixed-player":
			return "packages/fixed-player";
		case "pie-inline-player":
			return "packages/inline-player";
		case "pie-esm-player":
			return "packages/esm-player";
	}
}

export default class PiePlayerBuildTag extends Command {
	static override description =
		"Build PIE player custom element tags (pie-fixed-player, pie-inline-player, pie-esm-player)";

	static override examples = [
		"$ bun run cli pie-packages:pie-player-build-tag --tag pie-fixed-player",
		"$ bun run cli pie-packages:pie-player-build-tag -t all --clean",
	];

	static override flags = {
		tag: Flags.string({
			char: "t",
			description: "Tag name to build",
			options: [...TAGS, "all"],
			required: true,
		}),
		clean: Flags.boolean({
			char: "c",
			description: "Clean dist/ before building",
			default: true,
		}),
	};

	public async run(): Promise<void> {
		const { flags } = await this.parse(PiePlayerBuildTag);
		const monorepoDir = process.cwd();

		const packagesDir = join(monorepoDir, "packages");
		if (!existsSync(packagesDir)) {
			this.error(
				`Expected to be run from pie-players repo root. Missing: ${packagesDir}`,
			);
		}

		const tag = flags.tag as TagName | "all";
		const tags: TagName[] = tag === "all" ? [...TAGS] : [tag];

		this.log("🔨 Building PIE player tags...\n");

		for (const t of tags) {
			const pkgRel = tagToPackageDir(t);
			const pkgDir = join(monorepoDir, pkgRel);

			if (!existsSync(pkgDir)) {
				this.error(`Package directory not found for ${t}: ${pkgDir}`);
			}

			if (flags.clean) {
				try {
					execSync("rm -rf dist", { cwd: pkgDir, stdio: "inherit" });
				} catch {
					// ignore
				}
			}

			this.log(`📦 ${t}: building in ${pkgRel}`);
			execSync("bun run build", { cwd: pkgDir, stdio: "inherit" });
			this.log(`✅ ${t}: built\n`);
		}
	}
}
