/**
 * Only IIFE and preloaded elements need the math renderer the item player
 * installs on window. ESM element builds bring their own, so a page that only
 * loads ESM elements never fetches the MathJax module the renderer comes from.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const readSource = (relativePath: string): string =>
	readFileSync(join(import.meta.dir, relativePath), "utf8");

describe("item-player math rendering contract", () => {
	test("importing the player installs no math renderer", () => {
		const source = readSource("../src/pie-item-player.ts");

		// Module-scope statements start in column 0; calls inside functions do not.
		expect(source).not.toMatch(
			/^(void\s+)?ensureItemPlayerMathRenderingReady\(/m,
		);
		expect(source).not.toMatch(
			/^(void\s+)?(await\s+)?initializeMathRendering\(/m,
		);
	});

	test("the load pipeline installs the math renderer for every strategy but ESM", () => {
		const source = readSource("../src/PieItemPlayer.svelte");
		const call = source.indexOf("await initializeMathRendering()");
		const guard = source.lastIndexOf(
			'if (normalizedStrategy !== "esm") {',
			call,
		);

		expect(call).toBeGreaterThan(-1);
		expect(source.indexOf("await initializeMathRendering()", call + 1)).toBe(
			-1,
		);
		expect(guard).toBeGreaterThan(-1);
		// No block closes between the guard and the call, so the call sits inside it.
		expect(source.slice(guard, call)).not.toContain("}");
	});
});
