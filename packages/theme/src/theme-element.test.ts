import { describe, expect, test } from "bun:test";
import {
	getPieColorScheme,
	registerPieColorSchemes,
	resolvePieColorSchemeVariables,
	unregisterPieColorScheme,
} from "./index.js";

describe("pie-theme color scheme registry", () => {
	test("registers and resolves custom color schemes", () => {
		registerPieColorSchemes([
			{
				id: "e2e-custom",
				name: "E2E Custom",
				variables: {
					"--pie-primary": "#123456",
					"--pie-background": "#f6f7f8",
				},
			},
		]);
		const resolved = resolvePieColorSchemeVariables("e2e-custom");
		expect(resolved["--pie-primary"]).toBe("#123456");
		expect(resolved["--pie-background"]).toBe("#f6f7f8");
		unregisterPieColorScheme("e2e-custom");
	});

	test("drops invalid variable keys for custom schemes", () => {
		registerPieColorSchemes([
			{
				id: "invalid-keys",
				name: "Invalid Keys",
				variables: {
					"--pie-primary": "#00aa00",
					"--custom-non-pie": "#ff00ff",
				},
			},
		]);
		const resolved = resolvePieColorSchemeVariables("invalid-keys");
		expect(resolved["--pie-primary"]).toBe("#00aa00");
		expect(resolved["--custom-non-pie"]).toBeUndefined();
		unregisterPieColorScheme("invalid-keys");
	});

	test("keeps built-in default scheme available", () => {
		const defaultScheme = getPieColorScheme("default");
		expect(defaultScheme?.id).toBe("default");
	});
});

