import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "../..");

/** The player configs whose specs load elements from the production bundle host. */
const CONFIGS = [
	"packages/item-player/playwright.config.ts",
	"packages/section-player/playwright.config.ts",
];

/**
 * Each config's `grepInvert`, read in a process of its own: the module cache
 * would otherwise hand back a config another test imported without the variable.
 */
function grepInvertOf(env) {
	const files = CONFIGS.map((file) => path.join(REPO_ROOT, file));
	const script = `
		const out = {};
		for (const file of ${JSON.stringify(files)}) {
			const { default: config } = await import(file);
			out[file] = config.grepInvert?.source ?? null;
		}
		console.log(JSON.stringify(out));
	`;
	const { PIE_E2E_IIFE: _unset, ...rest } = process.env;
	const result = spawnSync(process.execPath, ["-e", script], {
		cwd: REPO_ROOT,
		env: { ...rest, ...env },
		encoding: "utf8",
	});
	expect(result.status, result.stderr).toBe(0);
	return Object.fromEntries(
		Object.entries(JSON.parse(result.stdout)).map(([file, source]) => [
			path.relative(REPO_ROOT, file),
			source,
		]),
	);
}

describe("iife e2e specs", () => {
	test("stay out of every run that does not opt in", () => {
		expect(grepInvertOf({})).toEqual(
			Object.fromEntries(CONFIGS.map((file) => [file, "@iife\\b"])),
		);
	});

	test("run under PIE_E2E_IIFE=1", () => {
		expect(grepInvertOf({ PIE_E2E_IIFE: "1" })).toEqual(
			Object.fromEntries(CONFIGS.map((file) => [file, null])),
		);
	});
});
