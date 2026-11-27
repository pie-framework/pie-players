import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Command } from "@oclif/core";

import { resolveMonorepoDir } from "../../utils/monorepo-root.js";

export default class PackLocal extends Command {
	static override description =
		"Build and pack local installable artifacts for PIEOneer testing (no npm publish).";

	static override examples = ["$ bun run cli pack:local"];

	public async run(): Promise<void> {
		const monorepoDir = resolveMonorepoDir();
		const script = join(monorepoDir, "scripts", "pack-local.mjs");
		if (!existsSync(script)) {
			this.error(`Missing pack-local script at: ${script}`);
		}

		execSync("bun run build", { cwd: monorepoDir, stdio: "inherit" });
		// `bun run build` removes tools/*/dist and builds no tools, and the CLI is packed too.
		execSync("bun run --cwd tools/cli build", {
			cwd: monorepoDir,
			stdio: "inherit",
		});
		execSync(`node "${script}"`, { cwd: monorepoDir, stdio: "inherit" });
	}
}
