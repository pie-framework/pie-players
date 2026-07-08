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
	new URL("../src/components/shared/SectionPassageCard.svelte", import.meta.url),
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
] as const;

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
});
