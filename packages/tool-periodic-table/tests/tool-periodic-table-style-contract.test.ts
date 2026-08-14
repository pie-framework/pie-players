import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-periodic-table.svelte", import.meta.url),
).text();
const styleSource = source.slice(source.indexOf("<style>"));
const collapsed = styleSource.replace(/\s+/g, " ");

/** The authored category palette, in the order the stylesheet declares it. */
const AUTHORED_FILLS = [
	"#ff9e9e",
	"#ffdc8a",
	"#ffdc8a",
	"#f9a8d4",
	"#e0aaff",
	"#a3d8f4",
	"#b4f8c8",
	"#d9f99d",
	"#f5f5f5",
	"#c4b5fd",
	"#fbcfe8",
	"#f0f0f0",
	"#8ef5d0",
	"#f5f5f5",
] as const;

const PINNED_INK = "#111827";

const hexToRgb = (hex: string): [number, number, number] => {
	const normalized = hex.replace("#", "");
	return [0, 2, 4].map((index) =>
		Number.parseInt(normalized.slice(index, index + 2), 16),
	) as [number, number, number];
};

const relativeLuminance = ([red, green, blue]: [number, number, number]) => {
	const toLinear = (channel: number) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return (
		0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
	);
};

/** Composites translucent text onto its fill, the way the compositor does. */
const flatten = (
	foreground: string,
	background: string,
	alpha: number,
): string => {
	const fg = hexToRgb(foreground);
	const bg = hexToRgb(background);
	return `#${fg
		.map((channel, index) =>
			Math.round(channel * alpha + bg[index] * (1 - alpha))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

const contrastRatio = (foreground: string, background: string): number => {
	const fg = relativeLuminance(hexToRgb(foreground));
	const bg = relativeLuminance(hexToRgb(background));
	return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
};

describe("periodic table category encoding", () => {
	test("every category fill collapses into the palette by the shared share", () => {
		const fills = [
			...collapsed.matchAll(
				/background-color: color-mix\( in srgb, var\(--pie-background-dark, #f5f5f5\) var\(--pie-fixed-hue-collapse, 0%\), (#[0-9a-f]{6}) \);/g,
			),
		].map((match) => match[1]);

		expect(fills).toEqual([...AUTHORED_FILLS]);
	});

	test("no category keeps a fill the palette cannot reach", () => {
		const categorySection = collapsed.slice(
			collapsed.indexOf("/* Category-based background colors"),
		);

		expect(categorySection).not.toMatch(/background-color: #[0-9a-f]{3,6}/);
		expect(categorySection).not.toMatch(/background: #[0-9a-f]{3,6}/);
	});

	test("cell ink and edge collapse with the fill they sit on", () => {
		// Ink: the pinned value at 0%, --pie-text at 100%. Both ends are exact, so a
		// Base Theme still renders the measured pastel pairing.
		expect(collapsed).toContain(
			`color: color-mix( in srgb, var(--pie-text, ${PINNED_INK}) var(--pie-fixed-hue-collapse, 0%), ${PINNED_INK} );`,
		);
		// Edge: collapsed fills sit on the panel surface at about 1.1:1, so the
		// border has to carry the separation the pastel used to.
		expect(collapsed).toContain(
			"border-color: color-mix( in srgb, var(--pie-border, #646464) var(--pie-fixed-hue-collapse, 0%), color-mix(in srgb, var(--pie-border-dark, #000) 12%, transparent) );",
		);
	});

	test("the selected-element panel keeps theme ink on the theme surface", () => {
		expect(collapsed).toContain(
			".pie-tool-periodic-table__selected-element.pie-tool-periodic-table__selected-grid {",
		);
		expect(collapsed).toContain(`color: var(--pie-text, ${PINNED_INK});`);
		expect(collapsed).toContain("background: var(--pie-background, #fff);");
	});

	test("the pinned ink clears AA on every fill, at every opacity the cell uses", () => {
		// The cell fades its secondary text: 0.9 for the element name, 0.8 for the
		// atomic number and mass. Measuring the ink alone would miss both.
		const CELL_TEXT_OPACITIES = [1, 0.9, 0.8] as const;

		for (const fill of new Set(AUTHORED_FILLS)) {
			for (const opacity of CELL_TEXT_OPACITIES) {
				expect(
					contrastRatio(flatten(PINNED_INK, fill, opacity), fill),
					`${fill} at ${opacity}`,
				).toBeGreaterThanOrEqual(4.5);
			}
		}
		// The two numbers the stylesheet comment claims, against the darkest fill.
		expect(
			contrastRatio(flatten(PINNED_INK, "#ff9e9e", 0.8), "#ff9e9e"),
		).toBeCloseTo(6.0, 1);
		expect(contrastRatio(PINNED_INK, "#ff9e9e")).toBeCloseTo(9.0, 1);
	});
});
