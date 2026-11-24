import { describe, expect, test } from "bun:test";

/**
 * A swatch shows the highlight it applies. `HighlightCoordinator` owns the
 * `::highlight()` fills, so each swatch has to paint the same token with the
 * same fallback, or the two drift apart under a scheme.
 */

const toolbar = await Bun.file(
	new URL("../tool-annotation-toolbar.svelte", import.meta.url),
).text();
const coordinator = await Bun.file(
	new URL(
		"../../assessment-toolkit/src/services/HighlightCoordinator.ts",
		import.meta.url,
	),
).text();

const SWATCHES = ["YELLOW", "PINK", "BLUE", "GREEN"] as const;

function swatchFill(name: (typeof SWATCHES)[number]): string | undefined {
	return new RegExp(`name: HighlightColor\\.${name},\\s*fill: '([^']+)'`).exec(
		toolbar,
	)?.[1];
}

function highlightFill(color: string): string | undefined {
	const rule = coordinator
		.split(`::highlight(pie-annotation-${color}) {`)
		.slice(1)
		.find((body) => body.trimStart().startsWith("background-color: var("));
	return /^\s*background-color: (var\([^;]+\));/.exec(rule ?? "")?.[1];
}

describe("annotation toolbar swatches", () => {
	test.each(SWATCHES)("the %s swatch paints its highlight's fill", (name) => {
		const color = name.toLowerCase();
		const fill = highlightFill(color);
		expect(fill).toMatch(
			new RegExp(
				`^var\\(--pie-annotation-${color}-highlight, #[0-9a-f]{6}\\)$`,
			),
		);
		expect(swatchFill(name)).toBe(fill);
	});

	test("each swatch's background is its fill", () => {
		expect(toolbar).toContain('style="background-color: {color.fill};"');
	});
});
