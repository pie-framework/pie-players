import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

/**
 * `PieSpinner` draws an absolutely positioned scrim at z-index 9999. Without a
 * positioned ancestor it resolves against the viewport and covers the host page
 * for as long as the player loads, which during a cold bundle build is the whole
 * retry window.
 */
const SOURCE = resolve(import.meta.dir, "../src/PieItemPlayer.svelte");

describe("the loading state", () => {
	const source = readFileSync(SOURCE, "utf8");
	const rule = source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.match(/\.pie-item-player-loading\s*\{[^}]*\}/);

	test("contains the spinner scrim to the player", () => {
		expect(rule).not.toBeNull();
		expect(rule?.[0]).toContain("position: relative");
	});

	test("keeps the scrim's z-index out of the host's stacking order", () => {
		expect(rule?.[0]).toContain("isolation: isolate");
	});
});
