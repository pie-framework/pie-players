import { describe, expect, test } from "bun:test";

/**
 * Two components paint the same banner, and only the `pie-item-player` one is
 * reachable from a browser test cheaply (see
 * `packages/item-player/tests/item-player-error-banner-scheme.spec.ts`). This
 * holds the pair together, so the copy that renders inside a section player
 * cannot drift back to a pinned hue unnoticed.
 */
const SOURCES = {
	"players-shared PieItemPlayer": await Bun.file(
		new URL("../src/components/PieItemPlayer.svelte", import.meta.url),
	).text(),
	"item-player PieItemPlayer": await Bun.file(
		new URL("../../item-player/src/PieItemPlayer.svelte", import.meta.url),
	).text(),
};

const errorBannerRule = (source: string): string => {
	const start = source.indexOf(".pie-player-error {");
	if (start === -1) {
		throw new Error("No .pie-player-error style rule");
	}
	const end = source.indexOf("\n\t}", start);
	const endSpaces = source.indexOf("\n  }", start);
	const close = [end, endSpaces].filter((index) => index !== -1).sort()[0];
	return source.slice(start, close).replace(/\s+/g, "");
};

describe("error banner theming", () => {
	for (const [name, source] of Object.entries(SOURCES)) {
		test(`${name} collapses its fixed red into the palette`, () => {
			const rule = errorBannerRule(source);

			// Pinned at 0%, which is every Base Theme; palette at 100%, every scheme.
			expect(rule).toContain("var(--pie-fixed-hue-collapse,0%)");
			expect(rule).toContain("var(--pie-incorrect,#d32f2f)");
			expect(rule).toContain("var(--pie-incorrect-secondary,#ffebee)");
			// The ink is the page's own, not the error hue: `--pie-incorrect` against
			// this tint falls to 4.14:1 under Black on White, while `--pie-text` holds
			// at 6.18:1 or better everywhere -- a declared relationship as of this
			// change, so `assertCanonicalThemeDefinitions` keeps it true.
			expect(rule).toContain("var(--pie-text,#c62828)");
		});

		test(`${name} keeps no pinned banner colour in its markup`, () => {
			// The literals belong in the collapse mix, where a scheme can reach them.
			// An inline `style` attribute would also outrank the rule entirely.
			const markup = source.slice(0, source.indexOf("<style>"));
			// Collected rather than asserted one by one: `not.toContain` on a whole
			// component prints the component on failure.
			const pinned = ["#ffebee", "#c62828", "#d32f2f"].filter((hex) =>
				markup.includes(hex),
			);
			expect(pinned, "pinned banner colours left in the markup").toEqual([]);
		});
	}
});
