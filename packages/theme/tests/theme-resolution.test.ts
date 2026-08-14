import { afterEach, describe, expect, spyOn, test } from "bun:test";

import {
	listPieColorSchemes,
	observePieColorSchemes,
	registerPieColorSchemes,
	resolvePieTheme,
} from "../src/color-schemes.js";

const activeReceipts: Array<{ unregister(): void }> = [];

function register(entries: Parameters<typeof registerPieColorSchemes>[0]) {
	const receipt = registerPieColorSchemes(entries);
	activeReceipts.push(receipt);
	return receipt;
}

afterEach(() => {
	for (const receipt of activeReceipts.splice(0)) receipt.unregister();
});

describe("resolvePieTheme", () => {
	test("applies base, provider, complete built-in, then explicit variables", () => {
		const resolved = resolvePieTheme({
			baseTheme: "dark",
			providerVariables: {
				"--pie-primary": "provider-primary",
				"--pie-tool-trigger-active-color": "provider-hook",
			},
			requestedScheme: "black-on-white",
			variables: {
				"--pie-primary": "explicit-primary",
				"--host-token": "allowed-as-an-explicit-override",
			},
		});

		expect(resolved.status).toBe("built-in");
		expect(resolved.resolvedScheme?.id).toBe("black-on-white");
		expect(resolved.variables["--pie-background"]).toBe("#ffffff");
		expect(resolved.variables["--pie-primary"]).toBe("explicit-primary");
		expect(resolved.variables["--pie-tool-trigger-active-color"]).toBe(
			"provider-hook",
		);
		expect(resolved.variables["--host-token"]).toBe(
			"allowed-as-an-explicit-override",
		);
	});

	test("custom schemes are partial overlays and use the fully resolved palette", () => {
		register([
			{
				id: "district-contrast",
				name: "District Contrast",
				variables: {
					"--pie-primary": "#123456",
					"--pie-correct": "#008300",
					"--pie-correct-tertiary": "#008300",
					"--pie-button-hover-border": "#898f9a",
				},
			},
		]);
		const resolved = resolvePieTheme({
			providerVariables: { "--pie-background": "#f6f7f8" },
			requestedScheme: "district-contrast",
		});

		expect(resolved.status).toBe("custom");
		expect(resolved.variables["--pie-primary"]).toBe("#123456");
		expect(resolved.variables["--pie-background"]).toBe("#f6f7f8");
		expect(resolved.diagnostics).toEqual([]);
	});

	test("collapses fixed component hues under any scheme, built-in or custom", () => {
		register([
			{ id: "district-two-colour", variables: { "--pie-text": "#ffffff" } },
			{
				id: "district-keeps-hues",
				variables: { "--pie-fixed-hue-collapse": "0%" },
			},
		]);

		expect(resolvePieTheme({}).variables["--pie-fixed-hue-collapse"]).toBe(
			"0%",
		);
		expect(
			resolvePieTheme({ requestedScheme: "black-on-white" }).variables[
				"--pie-fixed-hue-collapse"
			],
		).toBe("100%");
		// A custom scheme is a palette a host chose for a learner: it collapses
		// without having to know the token exists, and opts out by declaring it.
		expect(
			resolvePieTheme({ requestedScheme: "district-two-colour" }).variables[
				"--pie-fixed-hue-collapse"
			],
		).toBe("100%");
		expect(
			resolvePieTheme({ requestedScheme: "district-keeps-hues" }).variables[
				"--pie-fixed-hue-collapse"
			],
		).toBe("0%");
		// An unavailable request leaves the base palette in force, hues included.
		expect(
			resolvePieTheme({ requestedScheme: "district-absent" }).variables[
				"--pie-fixed-hue-collapse"
			],
		).toBe("0%");
	});

	test("validates custom contrast after final explicit overrides", () => {
		register([
			{
				id: "explicit-repair",
				variables: { "--pie-text": "#777777" },
			},
		]);

		const unresolved = resolvePieTheme({
			providerVariables: { "--pie-background": "#ffffff" },
			requestedScheme: "explicit-repair",
		});
		expect(unresolved.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "contrast-too-low",
				token: "--pie-text",
			}),
		);

		const repaired = resolvePieTheme({
			providerVariables: { "--pie-background": "#ffffff" },
			requestedScheme: "explicit-repair",
			variables: { "--pie-text": "#000000" },
		});
		expect(
			repaired.diagnostics.some(
				(item) =>
					item.code === "contrast-too-low" && item.token === "--pie-text",
			),
		).toBe(false);

		const dark = resolvePieTheme({
			baseTheme: "dark",
			requestedScheme: "explicit-repair",
			variables: { "--pie-text": "#666666" },
		});
		expect(dark.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "contrast-too-low",
				token: "--pie-text",
			}),
		);
	});

	test("retains an unavailable request and restores it after late registration", () => {
		const unavailable = resolvePieTheme({
			requestedScheme: "late-scheme",
		});
		expect(unavailable.requestedScheme).toBe("late-scheme");
		expect(unavailable.status).toBe("unavailable");
		expect(unavailable.resolvedScheme).toBeNull();
		expect(unavailable.variables["--pie-primary"]).toBe("#3f51b5");

		const receipt = register([
			{
				id: "late-scheme",
				variables: { "--pie-primary": "#123456" },
			},
		]);
		expect(resolvePieTheme({ requestedScheme: "late-scheme" }).status).toBe(
			"custom",
		);

		receipt.unregister();
		expect(resolvePieTheme({ requestedScheme: "late-scheme" }).status).toBe(
			"unavailable",
		);
	});

	test("returns deeply immutable results", () => {
		const resolved = resolvePieTheme({
			requestedScheme: "white-on-black",
		});
		expect(Object.isFrozen(resolved)).toBe(true);
		expect(Object.isFrozen(resolved.variables)).toBe(true);
		expect(Object.isFrozen(resolved.diagnostics)).toBe(true);
		expect(Object.isFrozen(resolved.resolvedScheme)).toBe(true);
		expect(Object.isFrozen(resolved.resolvedScheme?.preview)).toBe(true);
	});
});

describe("registerPieColorSchemes", () => {
	test("projects partial and unresolved custom previews onto a stable swatch", () => {
		register([
			{
				id: "partial-preview",
				variables: {
					"--pie-background": "transparent",
					"--pie-primary": "var(--pie-secondary)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "partial-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("preserves opaque CSS color syntaxes in custom previews", () => {
		register([
			{
				id: "css-color-preview",
				variables: {
					"--pie-background": "hsl(0 0% 100%)",
					"--pie-text": "navy",
					"--pie-primary": "color(display-p3 1 0 0)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "css-color-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "hsl(0 0% 100%)",
			text: "navy",
			primary: "color(display-p3 1 0 0)",
		});
	});

	test("falls back for invalid CSS color strings", () => {
		register([
			{
				id: "invalid-color-preview",
				variables: {
					"--pie-background": "not-a-color",
					"--pie-text": "bogus",
					"--pie-primary": "definitely-invalid",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "invalid-color-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("falls back for malformed functional color syntax", () => {
		register([
			{
				id: "malformed-functional-preview",
				variables: {
					"--pie-background": "rgb(1, 2%, 3)",
					"--pie-text": "hsl(0, 0, 0)",
					"--pie-primary": "color(display-p3 1 0)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "malformed-functional-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("falls back when Unicode would change CSS tokenization or case folding", () => {
		register([
			{
				id: "unicode-color-preview",
				variables: {
					"--pie-background": "rgb(1\u00a02\u00a03)",
					"--pie-text": "hsl(0\u20032%\u20033%)",
					"--pie-primary": "blac\u212a",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "unicode-color-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("falls back for alpha colors that cannot form a stable preview", () => {
		register([
			{
				id: "alpha-preview",
				variables: {
					"--pie-background": "hsl(0 0% 100% / 50%)",
					"--pie-text": "#0000",
					"--pie-primary": "rgba(63, 81, 181, 0.5)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "alpha-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("falls back for explicit and near-opaque alpha without quantizing it", () => {
		register([
			{
				id: "near-opaque-alpha-preview",
				variables: {
					"--pie-background": "color(display-p3 1 1 1 / .999)",
					"--pie-text": "#000000ff",
					"--pie-primary": "rgb(63 81 181 / 100%)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "near-opaque-alpha-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("falls back for nested alpha and relative CSS color expressions", () => {
		register([
			{
				id: "nested-alpha-preview",
				variables: {
					"--pie-background": "color-mix(in srgb, #0000 50%, white)",
					"--pie-text": "hsl(from #0000 h s l)",
					"--pie-primary": "color(from rgb(63 81 181 / .5) srgb r g b)",
				},
			},
			{
				id: "relative-alias-preview",
				variables: {
					"--pie-background": "rgba(from #0000 r g b)",
					"--pie-text": "hsla(from #0000 h s l)",
				},
			},
		]);

		const preview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "nested-alpha-preview",
		)?.preview;
		expect(preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
		const aliasPreview = listPieColorSchemes().schemes.find(
			(scheme) => scheme.id === "relative-alias-preview",
		)?.preview;
		expect(aliasPreview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("accepts valid siblings and rejects an invalid entry atomically", () => {
		const receipt = register([
			{
				id: "valid-sibling",
				variables: { "--pie-primary": "#123456" },
			},
			{
				id: "invalid-sibling",
				variables: {
					"--pie-primary": "#654321",
					"--not-registered": "#ffffff",
				},
			},
		]);

		expect(receipt.acceptedSchemeIds).toEqual(["valid-sibling"]);
		expect(receipt.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "invalid-token-name",
				schemeId: "invalid-sibling",
			}),
		);
		expect(resolvePieTheme({ requestedScheme: "invalid-sibling" }).status).toBe(
			"unavailable",
		);
	});

	test("rejects reserved and excluded tokens", () => {
		const receipt = register([
			{
				id: "black-on-white",
				variables: { "--pie-primary": "#123456" },
			},
			{
				id: "excluded-token",
				variables: { "--pie-font-scale": "1.2" },
			},
		]);
		expect(receipt.acceptedSchemeIds).toEqual([]);
		expect(receipt.diagnostics.map((item) => item.code)).toContain(
			"reserved-scheme-id",
		);
		expect(receipt.diagnostics.map((item) => item.code)).toContain(
			"excluded-token",
		);
	});

	test("latest valid registration wins and stale receipts cannot remove it", () => {
		const first = register([
			{
				id: "replaceable",
				variables: { "--pie-primary": "#111111" },
			},
		]);
		const second = register([
			{
				id: "replaceable",
				variables: { "--pie-primary": "#222222" },
			},
		]);

		first.unregister();
		expect(
			resolvePieTheme({ requestedScheme: "replaceable" }).variables[
				"--pie-primary"
			],
		).toBe("#222222");
		second.unregister();
		second.unregister();
		expect(resolvePieTheme({ requestedScheme: "replaceable" }).status).toBe(
			"unavailable",
		);
	});

	test("invalid replacement leaves the existing valid definition", () => {
		register([
			{
				id: "stable",
				variables: { "--pie-primary": "#123456" },
			},
		]);
		const invalid = register([
			{
				id: "stable",
				variables: { "--pie-font-scale": "2" },
			},
		]);

		expect(invalid.acceptedSchemeIds).toEqual([]);
		expect(
			resolvePieTheme({ requestedScheme: "stable" }).variables["--pie-primary"],
		).toBe("#123456");
	});
});

describe("color-scheme observation", () => {
	test("delivers an immutable current snapshot and once per completed batch", () => {
		const generations: number[] = [];
		const stop = observePieColorSchemes((snapshot) => {
			expect(Object.isFrozen(snapshot)).toBe(true);
			expect(Object.isFrozen(snapshot.schemes)).toBe(true);
			generations.push(snapshot.generation);
		});
		const receipt = register([
			{
				id: "one",
				variables: { "--pie-primary": "#111111" },
			},
			{
				id: "two",
				variables: { "--pie-primary": "#222222" },
			},
		]);
		receipt.unregister();
		stop();

		expect(generations).toHaveLength(3);
		expect(generations[1]).toBe(generations[0] + 1);
		expect(generations[2]).toBe(generations[1] + 1);
	});

	test("isolates listener failures and completes coherent reentrant mutations", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		const seenBySecond: number[] = [];
		let reentered = false;
		const stopFirst = observePieColorSchemes((snapshot) => {
			if (
				snapshot.schemes.some((scheme) => scheme.id === "outer") &&
				!reentered
			) {
				reentered = true;
				register([
					{
						id: "inner",
						variables: { "--pie-primary": "#222222" },
					},
				]);
			}
		});
		const stopThrowing = observePieColorSchemes(() => {
			if (reentered) throw new Error("observer failure");
		});
		const stopSecond = observePieColorSchemes((snapshot) => {
			seenBySecond.push(snapshot.generation);
		});

		register([
			{
				id: "outer",
				variables: { "--pie-primary": "#111111" },
			},
		]);

		stopFirst();
		stopThrowing();
		stopSecond();
		warn.mockRestore();
		expect(seenBySecond).toHaveLength(3);
		expect(seenBySecond[2]).toBe(seenBySecond[1] + 1);
		expect(
			listPieColorSchemes().schemes.some((scheme) => scheme.id === "inner"),
		).toBe(true);
	});
});
