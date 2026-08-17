import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * `pie-item-player` is one of the hosts `font-sizes.css` scales, so text inside
 * it that inherits its size already follows the accommodation. The build warning
 * declares its own size and would not, and a learner can be the one reading it.
 *
 * Stated as `calc(... * var(--pie-font-scale, 1))` rather than left to inherit,
 * matching the section-player content rules — the equivalent guard lives in
 * `packages/section-player/tests/content-text-follows-font-scale.test.ts`.
 */
const SOURCE = resolve(import.meta.dir, "../src/PieItemPlayer.svelte");

describe("the build warning", () => {
	const source = readFileSync(SOURCE, "utf8");

	test("scales with the font accommodation", () => {
		const rule = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.match(/\.pie-item-player-build-warning\s*\{[^}]*\}/);

		expect(rule).not.toBeNull();
		expect(rule?.[0]).toContain(
			"font-size: calc(0.95rem * var(--pie-font-scale, 1))",
		);
	});
});
