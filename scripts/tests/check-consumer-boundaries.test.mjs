import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectImportSpecifiers } from "../check-consumer-boundaries.mjs";

describe("check-consumer-boundaries import collection", () => {
	test("collects static, side-effect, dynamic and re-export specifiers", () => {
		const source = `
			import { a } from "static-package";
			import "@pie-players/pie-section-player/components/Layout.svelte?customElement";
			import'@pie-players/pie-item-player/src/index.ts';
			const lazy = await import("dynamic-package");
			export { b } from "re-exported-package";
		`;

		expect([...collectImportSpecifiers(source)].sort()).toEqual([
			"@pie-players/pie-item-player/src/index.ts",
			"@pie-players/pie-section-player/components/Layout.svelte?customElement",
			"dynamic-package",
			"re-exported-package",
			"static-package",
		]);
	});
});

describe("check-consumer-boundaries as a script", () => {
	test("reports a violation when run from a path that needs URL-encoding", () => {
		// `import.meta.url` percent-encodes the space that `process.argv[1]` keeps,
		// so a main guard comparing the two never runs the check and exits 0.
		const root = mkdtempSync(path.join(tmpdir(), "pie consumer boundaries "));
		mkdirSync(path.join(root, "scripts"));
		mkdirSync(path.join(root, "apps", "demo"), { recursive: true });
		copyFileSync(
			fileURLToPath(new URL("../check-consumer-boundaries.mjs", import.meta.url)),
			path.join(root, "scripts", "check-consumer-boundaries.mjs"),
		);
		writeFileSync(
			path.join(root, "apps", "demo", "page.ts"),
			'import "@pie-players/pie-section-player/components/Layout.svelte?customElement";\n',
		);

		const result = spawnSync(
			process.execPath,
			["./scripts/check-consumer-boundaries.mjs"],
			{ cwd: root, encoding: "utf8" },
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("(custom-element-query-import)");
	});
});
