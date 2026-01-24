import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { Command } from "@oclif/core";

export default class PackLocal extends Command {
	static override description =
		"Build and pack local installable artifacts for PIEOneer testing (no npm publish).";

	static override examples = ["$ pie-players pack:local"];

	public async run(): Promise<void> {
		const monorepoDir = process.cwd();
		const script = join(monorepoDir, "scripts", "pack-local.mjs");
		if (!existsSync(script)) {
			this.error(`Missing pack-local script at: ${script}`);
		}

		execSync("bun run build", { cwd: monorepoDir, stdio: "inherit" });
		execSync(`node "${script}"`, { cwd: monorepoDir, stdio: "inherit" });
	}
}
