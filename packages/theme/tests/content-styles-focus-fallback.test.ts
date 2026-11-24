import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

import { PIE_THEME_CONTRAST_RELATIONSHIPS } from "../src/theme-definitions.js";

const collapsed = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
)
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, "");

const FALLBACK_RING =
	/:where\(\[data-pie-content\]\):where\(:focus-visible\)\{outline:2pxsolidvar\((--pie-[\w-]+),([^;]+)\);outline-offset:2px;\}/;

describe("item content focus fallback ring", () => {
	// render-ui's `color.keyboardFocusOutline()` reads the same chain.
	test("draws from the keyboard focus chain", () => {
		const [, leading, rest] = collapsed.match(FALLBACK_RING) ?? [];
		expect(`${leading},${rest}`).toBe(
			"--pie-focus-keyboard-outline,var(--pie-focus-outline,var(--pie-button-focus-outline,var(--pie-focus-checked-border,#1565c0)))",
		);
	});

	// The contract test certifies the ring only while its leading token is held
	// at 3:1 against the page and the raised surface.
	test("leads with a token the contract holds at 3:1", () => {
		const [, leading] = collapsed.match(FALLBACK_RING) ?? [];
		for (const background of ["--pie-background", "--pie-surface"]) {
			expect(
				PIE_THEME_CONTRAST_RELATIONSHIPS.some(
					(relationship) =>
						relationship.foreground === leading &&
						relationship.background === background &&
						relationship.minimum >= 3,
				),
				background,
			).toBe(true);
		}
	});
});
