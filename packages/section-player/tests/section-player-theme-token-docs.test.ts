import { describe, expect, test } from "bun:test";

const componentSource = await Bun.file(
	new URL(
		"../src/components/shared/SectionPlayerTabbedContent.svelte",
		import.meta.url,
	),
).text();
const itemCardSource = await Bun.file(
	new URL("../src/components/shared/SectionItemCard.svelte", import.meta.url),
).text();
const passageCardSource = await Bun.file(
	new URL(
		"../src/components/shared/SectionPassageCard.svelte",
		import.meta.url,
	),
).text();
const splitPaneSource = await Bun.file(
	new URL(
		"../src/components/PieSectionPlayerSplitPaneElement.svelte",
		import.meta.url,
	),
).text();
const readme = await Bun.file(new URL("../README.md", import.meta.url)).text();

const tabTokens = [
	"--pie-section-player-tab-color",
	"--pie-section-player-tab-background",
	"--pie-section-player-tab-active-color",
	"--pie-section-player-tab-active-background",
	"--pie-section-player-tab-gap",
	"--pie-section-player-tab-track-radius",
	"--pie-section-player-tab-track-padding",
	"--pie-section-player-tab-padding-block",
] as const;

const cardTokens = [
	"--pie-section-player-card-radius",
	"--pie-section-player-card-header-radius",
	"--pie-section-player-card-header-background",
	"--pie-section-player-card-header-background-dark",
] as const;

/*
 * The pane background lives in a grouped selector covering the items pane too,
 * so a passage-header hook there repaints a pane that holds no passage header.
 * It intentionally has no pane-specific hook: the backdrop stays with the theme.
 * Comments are stripped first — one of them names the token being ruled out.
 */
const paneRule =
	splitPaneSource
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.match(
			/\.pie-section-player-passages-pane,\s*\.pie-section-player-items-pane\s*\{[\s\S]*?\}/,
		)?.[0] ?? "";

describe("section-player tab theme token docs", () => {
	test("README documents the actual tab tokens consumed by tabbed layout", () => {
		for (const token of tabTokens) {
			expect(componentSource).toContain(token);
			expect(readme).toContain(token);
		}
	});

	test("README does not advertise retired tab token names without aliases", () => {
		expect(readme).not.toContain("--pie-section-player-tab-indicator-color");
		expect(readme).not.toContain("--pie-section-player-tab-spacing");
	});
});

describe("section-player card theme token docs", () => {
	test("README documents the actual card tokens consumed by item and passage cards", () => {
		for (const token of cardTokens) {
			expect(itemCardSource).toContain(token);
			expect(passageCardSource).toContain(token);
			expect(readme).toContain(token);
		}
	});

	test("passage card bridges --pie-passage-header-background to the shared card header token", () => {
		expect(passageCardSource).toContain(
			"--pie-passage-header-background: var(--pie-section-player-card-header-background)",
		);
		expect(readme).toContain("--pie-passage-header-background");
	});

	/*
	 * A host that sets only the light hook must keep getting it under a dark
	 * theme, so the dark rule has to fall back rather than reset to transparent.
	 */
	test("the dark header fill falls back to the light hook on both cards", () => {
		for (const source of [itemCardSource, passageCardSource]) {
			expect(source).toContain(
				`background: var(
			--pie-section-player-card-header-background-dark,
			var(--pie-section-player-card-header-background, transparent)
		);`,
			);
		}
	});

	test("the dark rule keys off the theme package's dark selectors", () => {
		for (const source of [itemCardSource, passageCardSource]) {
			expect(source).toContain('[data-theme="dark"]');
			expect(source).toContain('pie-theme[theme="dark"]');
		}
	});

	test("the passage bridge carries the dark hook to a hosted passage-player", () => {
		expect(passageCardSource).toContain(
			`--pie-passage-header-background: var(
			--pie-section-player-card-header-background-dark,
			var(--pie-section-player-card-header-background)
		);`,
		);
	});
});

describe("section-player pane backdrop theme token docs", () => {
	test("the pane backdrop reads the canonical surface token, documented in the README", () => {
		expect(paneRule).toContain(
			"background: var(--pie-background-dark, #ecedf1);",
		);
		expect(readme).toContain("### Split-pane backdrop");
	});

	test("the pane backdrop is not driven by the passage header hook", () => {
		expect(paneRule).not.toContain("--pie-passage-header-background");
	});
});
