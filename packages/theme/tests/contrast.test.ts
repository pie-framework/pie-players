import { describe, expect, test } from "bun:test";

import {
	type ColorMeasure,
	type Srgb,
	UNMEASURED_HUE_WEIGHT,
	contrastRatio,
	legibleColorAgainst,
	legibleStateFillAgainst,
	mixTowards,
	relativeLuminance,
} from "../src/contrast.js";

const WHITE: Srgb = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Srgb = { r: 0, g: 0, b: 0, a: 1 };

const HEX = /^#([0-9a-f]{6})$/i;
const MIX = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/;

/**
 * Stands in for the browser's colour parser: hex, `rgba()` and the one
 * `color-mix()` shape this module emits. Enough to drive the stepping logic
 * without a canvas, which is the point of injecting the measurer.
 */
const measure: ColorMeasure = (value) => {
	const raw = value.trim();
	const hex = HEX.exec(raw);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
	}
	const rgba = /^rgba?\(([^)]+)\)$/i.exec(raw);
	if (rgba) {
		const parts = rgba[1].split(",").map((part) => Number.parseFloat(part));
		return {
			r: parts[0],
			g: parts[1],
			b: parts[2],
			a: parts.length > 3 ? parts[3] : 1,
		};
	}
	const mix = MIX.exec(raw);
	if (mix) {
		const left = measure(mix[1]);
		const right = measure(mix[3]);
		if (!left || !right) {
			return null;
		}
		const weight = Number.parseInt(mix[2], 10) / 100;
		const blend = (a: number, b: number) =>
			Math.round(a * weight + b * (1 - weight));
		return {
			r: blend(left.r, right.r),
			g: blend(left.g, right.g),
			b: blend(left.b, right.b),
			a: 1,
		};
	}
	return null;
};

/** Resolves only flat colours, the way a measurer without `color-mix` support would. */
const measureWithoutColorMix: ColorMeasure = (value) =>
	MIX.test(value.trim()) ? null : measure(value);

function ratioAgainst(value: string | undefined, background: string): number {
	const foreground = measure(value ?? "");
	const surface = measure(background);
	if (!foreground || !surface) {
		throw new Error(`unmeasurable: ${value}`);
	}
	return contrastRatio(foreground, surface);
}

function hueWeightOf(value: string | undefined): number {
	const mix = MIX.exec((value ?? "").trim());
	if (!mix) {
		throw new Error(`not a mix: ${value}`);
	}
	return Number.parseInt(mix[2], 10);
}

describe("contrastRatio", () => {
	test("matches the WCAG reference extremes", () => {
		expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
		expect(contrastRatio(WHITE, WHITE)).toBeCloseTo(1, 5);
	});

	test("is symmetric", () => {
		const grey: Srgb = { r: 119, g: 119, b: 119, a: 1 };
		expect(contrastRatio(grey, WHITE)).toBeCloseTo(
			contrastRatio(WHITE, grey),
			10,
		);
	});
});

describe("relativeLuminance", () => {
	test("spans 0 to 1", () => {
		expect(relativeLuminance(BLACK)).toBeCloseTo(0, 10);
		expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
	});
});

describe("legibleColorAgainst", () => {
	const onWhite = {
		text: "#000000",
		background: "#ffffff",
		measure,
	};

	test("leaves a hue that already passes untouched", () => {
		// A theme that picked a legible mark keeps the exact colour it picked;
		// correcting it anyway would be this package overruling the theme.
		expect(legibleColorAgainst({ hue: "#146c2e", ...onWhite })).toBe("#146c2e");
	});

	test("corrects a hue that fails, and the correction passes", () => {
		// DaisyUI's light success slot lands near this: a pale green fill, unreadable
		// as a mark on the page.
		const corrected = legibleColorAgainst({ hue: "#4ade80", ...onWhite });
		expect(corrected).not.toBe("#4ade80");
		expect(ratioAgainst(corrected, "#ffffff")).toBeGreaterThanOrEqual(4.5);
	});

	test("keeps the largest hue share that clears the threshold", () => {
		// The whole reason for stepping rather than using one weight: the mark has
		// to stay the colour that carries its meaning.
		const corrected = legibleColorAgainst({ hue: "#4ade80", ...onWhite });
		const weight = hueWeightOf(corrected);
		const oneStepMoreHue = mixTowards("#4ade80", "#000000", weight + 5);
		expect(ratioAgainst(oneStepMoreHue, "#ffffff")).toBeLessThan(4.5);
	});

	test("mixes toward the theme's text colour, so a dark theme lightens", () => {
		const corrected = legibleColorAgainst({
			hue: "#7f1d1d",
			text: "#f8f8f2",
			background: "#282a36",
			measure,
		});
		const surface = measure("#282a36");
		const resolved = measure(corrected ?? "");
		if (!surface || !resolved) {
			throw new Error("unmeasurable");
		}
		expect(relativeLuminance(resolved)).toBeGreaterThan(
			relativeLuminance(surface),
		);
		expect(contrastRatio(resolved, surface)).toBeGreaterThanOrEqual(4.5);
	});

	test("honours a caller-supplied minimum", () => {
		const text = legibleColorAgainst({ hue: "#4ade80", ...onWhite });
		const nonText = legibleColorAgainst({
			hue: "#4ade80",
			...onWhite,
			minimum: 3,
		});
		expect(hueWeightOf(nonText)).toBeGreaterThan(hueWeightOf(text));
		expect(ratioAgainst(nonText, "#ffffff")).toBeGreaterThanOrEqual(3);
	});

	test("falls back to the pessimistic weight with no measurer", () => {
		// Server-side and under a DOM shim there is no canvas to paint on.
		const corrected = legibleColorAgainst({
			hue: "#4ade80",
			text: "#000000",
			background: "#ffffff",
		});
		expect(hueWeightOf(corrected)).toBe(UNMEASURED_HUE_WEIGHT);
	});

	test("falls back to the pessimistic weight when color-mix is unmeasurable", () => {
		// Stepping cannot be verified, so stop at the weight the sweep says is safe
		// rather than walking all the way down to the text colour.
		const corrected = legibleColorAgainst({
			hue: "#4ade80",
			text: "#000000",
			background: "#ffffff",
			measure: measureWithoutColorMix,
		});
		expect(hueWeightOf(corrected)).toBe(UNMEASURED_HUE_WEIGHT);
	});

	test("does not pretend to measure a translucent hue", () => {
		const corrected = legibleColorAgainst({
			hue: "rgba(74, 222, 128, 0.4)",
			...onWhite,
		});
		expect(hueWeightOf(corrected)).toBe(UNMEASURED_HUE_WEIGHT);
	});

	test("gives up on hue rather than on legibility", () => {
		// A theme whose text colour is its own surface leaves nothing to mix toward
		// that would pass, so the loop runs out and the text colour wins. Legibility
		// is the invariant; keeping the hue is the preference.
		expect(
			legibleColorAgainst({
				hue: "#ffffff",
				text: "#ffffff",
				background: "#ffffff",
				measure,
			}),
		).toBe("#ffffff");
	});

	test("passes an absent hue through as absent", () => {
		expect(legibleColorAgainst({ hue: undefined, ...onWhite })).toBeUndefined();
	});

	test("returns the hue verbatim when there is no text colour to mix toward", () => {
		expect(
			legibleColorAgainst({ hue: "#4ade80", background: "#ffffff", measure }),
		).toBe("#4ade80");
	});
});

describe("legibleStateFillAgainst", () => {
	test("leaves a fill that already clears 3:1 against the page untouched", () => {
		expect(
			legibleStateFillAgainst({
				fill: "#81848f",
				text: "#000000",
				background: "#ffffff",
				measure,
			}),
		).toBe("#81848f");
	});

	test("moves a faint fill toward the ink until it clears 3:1, text intact", () => {
		const fill = legibleStateFillAgainst({
			fill: "#f2f2f2",
			text: "#1f1f1f",
			background: "#ffffff",
			measure,
		});
		expect(ratioAgainst(fill, "#ffffff")).toBeGreaterThanOrEqual(3);
		expect(ratioAgainst("#1f1f1f", measuredHex(fill))).toBeGreaterThanOrEqual(
			4.5,
		);
		// The first 1% step that clears it, not a coarser one.
		const weight = hueWeightOf(fill);
		expect(
			ratioAgainst(mixTowards("#f2f2f2", "#1f1f1f", weight + 1), "#ffffff"),
		).toBeLessThan(3);
	});

	test("stops at the text floor when the page leaves no room for both", () => {
		// 5.45:1 of ink on the page: 3:1 on one side leaves 1.8:1 on the other.
		const fill = legibleStateFillAgainst({
			fill: "#f9e4f0",
			text: "#c5005a",
			background: "#fcf2f8",
			measure,
		});
		expect(ratioAgainst(fill, "#fcf2f8")).toBeLessThan(3);
		expect(ratioAgainst("#c5005a", measuredHex(fill))).toBeGreaterThanOrEqual(
			4.5,
		);
		const weight = hueWeightOf(fill);
		expect(
			ratioAgainst(
				"#c5005a",
				measuredHex(mixTowards("#f9e4f0", "#c5005a", weight - 1)),
			),
		).toBeLessThan(4.5);
	});

	test("returns the fill verbatim when it cannot be measured", () => {
		expect(
			legibleStateFillAgainst({
				fill: "#f2f2f2",
				text: "#1f1f1f",
				background: "#ffffff",
				measure: null,
			}),
		).toBe("#f2f2f2");
	});

	test("does not trade away text that is already under the floor", () => {
		expect(
			legibleStateFillAgainst({
				// Black on #555555 is 2.82:1 before any correction.
				fill: "#555555",
				text: "#000000",
				background: "#666666",
				measure,
			}),
		).toBe("#555555");
	});
});

function measuredHex(value: string | undefined): string {
	const color = measure(value ?? "");
	if (!color) {
		throw new Error(`unmeasurable: ${value}`);
	}
	return `#${[color.r, color.g, color.b]
		.map((channel) => channel.toString(16).padStart(2, "0"))
		.join("")}`;
}
