/**
 * The `"none"` provider mode: resolve nothing, keep the shipped defaults.
 *
 * A host needs this to answer "why do the colours differ between these two
 * environments" — selecting it reproduces the palette from before a provider was
 * adopted. Naming an unregistered provider lands in the same place by accident,
 * so the tests below pin the parts that make it a mode rather than a coincidence.
 *
 * No DOM: under this mode `resolveProviderVariables` returns before it touches
 * the target or `document`, so a stub target is the honest way to exercise it.
 */

import { beforeEach, describe, expect, spyOn, test } from "bun:test";

import {
	PIE_THEME_PROVIDER_NONE,
	getPieThemeProvider,
	registerPieThemeProvider,
	resolveProviderVariables,
	unregisterPieThemeProvider,
} from "../src/providers";

const PROBE_TOKEN = "--pie-background";

/** Claims it can read anything, so only the mode can stop it resolving. */
const probeAdapter = {
	id: "provider-none-probe",
	canRead: () => true,
	read: () => ({ [PROBE_TOKEN]: "rgb(1, 2, 3)" }),
};

const target = {} as unknown as HTMLElement;

// The built-in DaisyUI adapter is ahead of the probe in registration order and
// reads computed styles to decide whether it applies. Answering "no variables"
// makes it decline, so `auto` reaches the probe — without this the `auto` half of
// the comparison below throws instead of resolving.
const stubComputedStyle = () => {
	(globalThis as { getComputedStyle?: unknown }).getComputedStyle = () =>
		({ getPropertyValue: () => "" }) as unknown as CSSStyleDeclaration;
};

describe("resolveProviderVariables with the none mode", () => {
	beforeEach(() => {
		stubComputedStyle();
		registerPieThemeProvider(probeAdapter);
	});

	test("resolves nothing even though a provider can read the target", () => {
		expect(
			resolveProviderVariables({ target, provider: "auto" }),
		).toHaveProperty(PROBE_TOKEN);
		expect(
			resolveProviderVariables({ target, provider: PIE_THEME_PROVIDER_NONE }),
		).toEqual({});
	});

	test("short-circuits ahead of the document-element retry", () => {
		// That retry exists so a subtree host inherits a themed page, and it would
		// put this provider's values straight back — the one thing the mode is asked
		// for. An empty result with an always-readable provider registered is what
		// proves the mode is decided before either lookup.
		expect(
			resolveProviderVariables({ target, provider: PIE_THEME_PROVIDER_NONE }),
		).toEqual({});
	});

	test("survives unregistering, because it is not a registered provider", () => {
		unregisterPieThemeProvider(PIE_THEME_PROVIDER_NONE);
		expect(
			resolveProviderVariables({ target, provider: PIE_THEME_PROVIDER_NONE }),
		).toEqual({});
	});

	test("cannot be shadowed by a registered provider", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			registerPieThemeProvider({
				id: PIE_THEME_PROVIDER_NONE,
				canRead: () => true,
				read: () => ({ [PROBE_TOKEN]: "shadowed" }),
			});
			expect(getPieThemeProvider(PIE_THEME_PROVIDER_NONE)).toBeUndefined();
			expect(
				resolveProviderVariables({ target, provider: PIE_THEME_PROVIDER_NONE }),
			).toEqual({});
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});

	test("is spelled the same as the attribute value a host writes", () => {
		expect(PIE_THEME_PROVIDER_NONE).toBe("none");
	});
});
