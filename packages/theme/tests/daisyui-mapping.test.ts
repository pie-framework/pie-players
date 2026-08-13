import { describe, expect, test } from "bun:test";

import type { ColorMeasure } from "../src/contrast.js";
import {
	DAISYUI_PIE_TOKEN_MAP,
	DAISY_SLOT_CSS_VARIABLES,
	type DaisySlot,
	resolveDaisyPieVariables,
} from "../src/daisyui-mapping.js";

/** DaisyUI's `light` theme, in the shape the mapping reads it. */
const LIGHT: Partial<Record<DaisySlot, string>> = {
	base100: "#ffffff",
	base200: "#f2f2f2",
	base300: "#e5e5e5",
	baseContent: "#1f1f1f",
	primary: "#422ad5",
	secondary: "#f43098",
	accent: "#00d3bb",
	neutral: "#1f1f1f",
	neutralContent: "#ffffff",
	success: "#4ade80",
	error: "#ff6467",
	warning: "#fcb700",
};

const HEX = /^#([0-9a-f]{6})$/i;
const MIX = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/;

const measure: ColorMeasure = (value) => {
	const raw = value.trim();
	const hex = HEX.exec(raw);
	if (hex) {
		const n = Number.parseInt(hex[1], 16);
		return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
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

const resolve = (
	tokens: Partial<Record<DaisySlot, string>>,
	withMeasure = true,
) =>
	resolveDaisyPieVariables({
		read: (slot) => tokens[slot],
		measure: withMeasure ? measure : null,
	});

function ratio(value: string, background: string): number {
	const fg = measure(value);
	const bg = measure(background);
	if (!fg || !bg) {
		throw new Error(`unmeasurable: ${value}`);
	}
	const lum = (c: { r: number; g: number; b: number }) => {
		const f = (v: number) => {
			const x = v / 255;
			return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
	};
	const a = lum(fg);
	const b = lum(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("DAISYUI_PIE_TOKEN_MAP", () => {
	test("names only slots it can read", () => {
		for (const entry of DAISYUI_PIE_TOKEN_MAP) {
			expect(DAISY_SLOT_CSS_VARIABLES[entry.from]).toBeDefined();
			if (entry.kind === "mix") {
				expect(DAISY_SLOT_CSS_VARIABLES[entry.towards]).toBeDefined();
			}
		}
	});

	test("declares each token once", () => {
		const tokens = DAISYUI_PIE_TOKEN_MAP.map((entry) => entry.token);
		expect(new Set(tokens).size).toBe(tokens.length);
	});
});

describe("resolveDaisyPieVariables", () => {
	test("keeps every feedback state on a slot of its own", () => {
		const vars = resolve(LIGHT);
		expect(vars["--pie-missing"]).not.toBe(vars["--pie-incorrect"]);
		expect(vars["--pie-incorrect"]).not.toBe(vars["--pie-correct"]);
	});

	test("brings feedback foregrounds up to the text minimum", () => {
		const vars = resolve(LIGHT);
		for (const token of ["--pie-correct", "--pie-incorrect", "--pie-missing"]) {
			expect(ratio(vars[token], "#ffffff")).toBeGreaterThanOrEqual(4.5);
		}
	});

	test("brings control boundaries up to the non-text minimum", () => {
		const vars = resolve(LIGHT);
		for (const token of [
			"--pie-border",
			"--pie-button-border",
			"--pie-button-hover-border",
		]) {
			expect(ratio(vars[token], "#ffffff")).toBeGreaterThanOrEqual(3);
		}
	});

	test("leaves the divider token alone", () => {
		// Card edges and pane dividers, which 1.4.11 exempts. Correcting it would
		// put a hard outline around every item card.
		expect(resolve(LIGHT)["--pie-border-light"]).toBe("#f2f2f2");
	});

	test("passes a slot that already clears its minimum through untouched", () => {
		const vars = resolve({ ...LIGHT, success: "#146c2e" });
		expect(vars["--pie-correct"]).toBe("#146c2e");
	});

	test("omits a token whose slot the caller did not supply", () => {
		const vars = resolve({ base100: "#ffffff", baseContent: "#1f1f1f" });
		expect(vars["--pie-primary"]).toBeUndefined();
		expect(vars["--pie-background"]).toBe("#ffffff");
	});

	test("omits a mix whose second slot is missing", () => {
		const vars = resolve({ primary: "#422ad5", baseContent: "#1f1f1f" });
		expect(vars["--pie-primary"]).toBe("#422ad5");
		expect(vars["--pie-primary-light"]).toBeUndefined();
	});

	test("still corrects without a measurer, at the fixed weights", () => {
		const vars = resolve(LIGHT, false);
		expect(vars["--pie-correct"]).toBe(
			"color-mix(in srgb, #4ade80 30%, #1f1f1f)",
		);
		expect(vars["--pie-border"]).toBe(
			"color-mix(in srgb, #e5e5e5 35%, #1f1f1f)",
		);
	});
});
