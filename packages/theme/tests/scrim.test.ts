import { describe, expect, test } from "bun:test";

import { resolvePieTheme } from "../src/color-schemes.js";
import {
	getBaseThemeVariables,
	listBuiltInColorSchemeDefinitions,
} from "../src/theme-definitions.js";

const palettes = [
	["light", getBaseThemeVariables("light")],
	["dark", getBaseThemeVariables("dark")],
	...listBuiltInColorSchemeDefinitions().map(
		(scheme) => [scheme.id, scheme.variables] as const,
	),
] as const;

describe("--pie-scrim", () => {
	// A modal backdrop recedes the page behind the dialog, so it darkens on every
	// palette: one that followed the ink would wash a dark page out.
	test.each(palettes)("%s sets a dark translucent veil", (_id, variables) => {
		const match = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(0?\.\d+)\s*\)$/.exec(
			variables["--pie-scrim"] ?? "",
		);
		expect(match, variables["--pie-scrim"]).not.toBeNull();
		const [r, g, b, alpha] = match!.slice(1).map(Number);
		expect(Math.max(r, g, b)).toBeLessThanOrEqual(32);
		expect(alpha).toBeGreaterThan(0);
		expect(alpha).toBeLessThan(1);
	});

	test("a host's variables override the scheme's veil", () => {
		const resolution = resolvePieTheme({
			baseTheme: "dark",
			requestedScheme: "yellow-on-navy",
			variables: { "--pie-scrim": "rgba(0, 0, 0, 0.6)" },
		});
		expect(resolution.variables["--pie-scrim"]).toBe("rgba(0, 0, 0, 0.6)");
	});
});
