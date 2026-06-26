import { describe, expect, test } from "bun:test";

const componentSource = await Bun.file(
	new URL(
		"../src/components/shared/SectionPlayerTabbedContent.svelte",
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
