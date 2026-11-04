import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const SCRIPTS = path.join(import.meta.dir, "..");
const CALLERS = ["check-publish-surface.mjs", "check-pack-integrity.mjs"];

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
});
