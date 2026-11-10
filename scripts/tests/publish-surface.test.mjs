import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { collectManifestSurfaceViolations } from "../lib/publish-surface.mjs";

const SCRIPTS = path.join(import.meta.dir, "..");
const CALLERS = ["check-source-exports.mjs", "check-pack-integrity.mjs"];

describe("publish-surface rules", () => {
	// The pre-commit check and the CI pack check once carried copies of these
	// rules, and the CI copy gained the build-config declaration rule alone, so
	// a package passed the hook and failed CI.
	test.each(CALLERS)("%s takes the rules from the shared module", (file) => {
		const source = readFileSync(path.join(SCRIPTS, file), "utf8");
		expect(source).toContain('from "./lib/publish-surface.mjs"');
		for (const rule of [
			"isBuildConfigDeclaration",
			"isRawSourceFile",
			"isAllowedPackedFile",
			"FORBIDDEN_EXPORT_CONDITIONS",
		]) {
			expect(source).not.toContain(rule);
		}
	});

	test("holds a bare top-level entry path to the dist-only rules", () => {
		// npm reads `"types": "src/index.ts"` like `"./src/index.ts"`, so the
		// bare form must not slip past the rules the `./` form fails.
		expect(
			collectManifestSurfaceViolations({
				main: "dist/index.js",
				types: "src/index.ts",
				module: "lib/index.js",
			}),
		).toEqual([
			"export target is outside dist: ./lib/index.js",
			"export target points at src: ./src/index.ts",
		]);
	});
});

describe("check-source-exports", () => {
	test("fails when it discovers no publishable package", () => {
		// A mistyped workspaceRoots reads as zero packages, which would report
		// "validated 0 publishable package(s)" and pass the pre-commit gate.
		const root = mkdtempSync(path.join(tmpdir(), "check-source-exports-"));
		writeFileSync(
			path.join(root, "package.json"),
			JSON.stringify({ private: true, workspaces: ["packages/*"] }),
		);
		mkdirSync(path.join(root, "scripts"));
		writeFileSync(
			path.join(root, "scripts", "publish-policy.json"),
			JSON.stringify({ workspaceRoots: ["pkgs"] }),
		);

		const result = spawnSync(
			process.execPath,
			[path.join(SCRIPTS, "check-source-exports.mjs")],
			{ cwd: root, encoding: "utf8" },
		);
		rmSync(root, { recursive: true, force: true });

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("no publishable packages discovered");
		expect(result.stdout).not.toContain("OK");
	});
});
