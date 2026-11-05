import { afterEach, describe, expect, test } from "bun:test";

import {
	registerPieColorSchemes,
	resolvePieTheme,
} from "../src/color-schemes.js";
import { contrastRatio, type Srgb } from "../src/contrast.js";
import { resolveDaisyPieVariables } from "../src/daisyui-mapping.js";
import {
	getBaseThemeVariables,
	listBuiltInColorSchemeDefinitions,
} from "../src/theme-definitions.js";

const activeReceipts: Array<{ unregister(): void }> = [];

afterEach(() => {
	for (const receipt of activeReceipts.splice(0)) receipt.unregister();
});

const srgb = (hex: string): Srgb => ({
	r: Number.parseInt(hex.slice(1, 3), 16),
	g: Number.parseInt(hex.slice(3, 5), 16),
	b: Number.parseInt(hex.slice(5, 7), 16),
	a: 1,
});

/**
 * The PIE elements' keypad key fill (`@pie-lib/render-ui` `keypadButton`):
 * `rgb(188, 194, 229)` on white, re-expressed as a 50% hue mixed into
 * `--pie-background`, so it follows the scheme.
 */
const keypadKeyFill = (background: string): Srgb => {
	const bg = srgb(background);
	const hue = [188, 194, 229].map((c) => 2 * c - 255);
	return {
		r: Math.round((hue[0] + bg.r) / 2),
		g: Math.round((hue[1] + bg.g) / 2),
		b: Math.round((hue[2] + bg.b) / 2),
		a: 1,
	};
};

const palettes = [
	["light", getBaseThemeVariables("light")],
	["dark", getBaseThemeVariables("dark")],
	...listBuiltInColorSchemeDefinitions().map(
		(scheme) => [scheme.id, scheme.variables] as const,
	),
] as const;

describe("--pie-focus-keyboard-outline", () => {
	test.each(palettes)(
		"holds 3:1 against the keypad key fill in %s",
		(_, variables) => {
			const ring = srgb(variables["--pie-focus-keyboard-outline"]);
			const fill = keypadKeyFill(variables["--pie-background"]);

			expect(contrastRatio(ring, fill)).toBeGreaterThanOrEqual(3);
		},
	);

	test("follows a custom scheme that sets only the button focus outline", () => {
		activeReceipts.push(
			registerPieColorSchemes([
				{
					id: "host-focus",
					name: "Host focus",
					variables: { "--pie-button-focus-outline": "#0000cc" },
				},
			]),
		);

		const resolved = resolvePieTheme({ requestedScheme: "host-focus" });

		expect(resolved.variables["--pie-focus-keyboard-outline"]).toBe("#0000cc");
	});

	test("follows explicit variables that set only the button focus outline", () => {
		const resolved = resolvePieTheme({
			variables: { "--pie-button-focus-outline": "#0000cc" },
		});

		expect(resolved.variables["--pie-focus-keyboard-outline"]).toBe("#0000cc");
	});

	test("keeps its own value where a palette sets both", () => {
		const resolved = resolvePieTheme({
			variables: {
				"--pie-button-focus-outline": "#0000cc",
				"--pie-focus-keyboard-outline": "#4a1259",
			},
		});

		expect(resolved.variables["--pie-focus-keyboard-outline"]).toBe("#4a1259");
	});

	test("takes the corrected button focus outline under DaisyUI", () => {
		const resolved = resolveDaisyPieVariables({
			read: (slot) =>
				({
					base100: "#ffffff",
					base300: "#e5e5e5",
					baseContent: "#1f1f1f",
					primary: "#422ad5",
				})[slot as string],
		});

		expect(resolved["--pie-focus-keyboard-outline"]).toBe(
			resolved["--pie-button-focus-outline"],
		);
	});
});
