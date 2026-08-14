import { describe, expect, test } from "bun:test";

import { PIE_THEME_SCHEME_PARTICIPATION } from "../src/scheme-participation";
import {
	getBaseThemeVariables,
	listBuiltInColorSchemeDefinitions,
} from "../src/theme-definitions";
import type { PieThemeTokenRegistry } from "../src/token-registry-types";

const registry = (await Bun.file(
	new URL("../src/token-registry.json", import.meta.url),
).json()) as PieThemeTokenRegistry;

const entriesByName = new Map(registry.map((entry) => [entry.name, entry]));

const activeCanonicalEntries = registry.filter(
	(entry) =>
		entry.owner === "@pie-players/pie-theme" &&
		entry.scope === "canonical-semantic" &&
		entry.status === "active",
);
const canonicalDefaultTokens = activeCanonicalEntries
	.map((entry) => entry.name)
	.sort();
const requiredSchemeTokens = registry
	.filter((entry) => entry.schemeParticipation === "required")
	.map((entry) => entry.name)
	.sort();
const requiredNonCanonicalTokens = registry
	.filter(
		(entry) =>
			entry.schemeParticipation === "required" &&
			!(entry.scope === "canonical-semantic" && entry.status === "active"),
	)
	.map((entry) => entry.name);
const expectedBaseTokens = [
	...new Set([...canonicalDefaultTokens, ...requiredNonCanonicalTokens]),
].sort();
const lightBaseTokens = Object.keys(getBaseThemeVariables("light")).sort();
const darkBaseTokens = Object.keys(getBaseThemeVariables("dark")).sort();

const requiredComponentPublicTokens = [
	"--pie-tool-trigger-active-background",
	"--pie-tool-trigger-active-border-color",
	"--pie-tool-trigger-active-color",
	"--pie-section-player-card-header-background",
	"--pie-section-player-card-header-radius",
	"--pie-section-player-card-radius",
	"--pie-section-player-tab-active-background",
	"--pie-section-player-tab-active-color",
	"--pie-section-player-tab-background",
	"--pie-section-player-tab-color",
	"--pie-section-player-tab-gap",
	"--pie-section-player-tab-padding-block",
	"--pie-section-player-tab-track-padding",
	"--pie-section-player-tab-track-radius",
] as const;

const requiredDecisionGateTokens = [
	"--pie-background-light",
	"--pie-button-background-color",
	"--pie-button-border-color",
	"--pie-button-hover-background-color",
	"--pie-focus-ring-color",
	"--pie-focus-outline",
] as const;

const tokensCss = await Bun.file(
	new URL("../src/tokens.css", import.meta.url),
).text();
const colorSchemesCss = await Bun.file(
	new URL("../src/color-schemes.css", import.meta.url),
).text();
const componentsCss = await Bun.file(
	new URL("../src/components.css", import.meta.url),
).text();

const extractCssDeclarations = (css: string): string[] =>
	[...css.matchAll(/(--pie-[a-z0-9-]+)\s*:/g)].map((match) => match[1]);

describe("PIE theme token registry contract", () => {
	test("registry entries use the expected unique shape", () => {
		expect(registry.length).toBeGreaterThan(0);
		expect(entriesByName.size).toBe(registry.length);

		for (const entry of registry) {
			expect(entry.name).toMatch(/^--pie-[a-z0-9-]+$/);
			expect(entry.owner).toMatch(/^@pie-players\/[a-z0-9-]+/);
			expect(entry.category.trim()).not.toBe("");
			expect(entry.fallbackPolicy?.trim()).not.toBe("");
			expect(entry.definedIn.length).toBeGreaterThan(0);
			expect(entry.documentedIn?.length).toBeGreaterThan(0);
			expect(["required", "optional", "excluded"]).toContain(
				entry.schemeParticipation,
			);
		}
	});

	test("canonical theme defaults are registered at their canonical definition", () => {
		for (const entry of activeCanonicalEntries) {
			expect(entry.definedIn).toContain(
				"packages/theme/src/theme-definitions.ts",
			);
			expect(entry.documentedIn).toContain("packages/theme/README.md");
		}
	});

	test("both Base Themes expose canonical defaults plus required accessibility hooks", () => {
		expect(lightBaseTokens).toEqual(expectedBaseTokens);
		expect(darkBaseTokens).toEqual(expectedBaseTokens);
	});

	test("active canonical registry entries are backed by both Base Themes", () => {
		const lightBaseSet = new Set(lightBaseTokens);
		const darkBaseSet = new Set(darkBaseTokens);

		for (const entry of activeCanonicalEntries) {
			expect(
				lightBaseSet.has(entry.name),
				`${entry.name} is active canonical but missing from the light Base Theme`,
			).toBe(true);
			expect(
				darkBaseSet.has(entry.name),
				`${entry.name} is active canonical but missing from the dark Base Theme`,
			).toBe(true);
		}
	});

	test("tokens.css stays in parity with canonical Base Theme definitions", () => {
		const cssTokenSet = new Set(extractCssDeclarations(tokensCss));

		expect([...cssTokenSet].sort()).toEqual(expectedBaseTokens);
	});

	test("generated scheme participation stays byte-for-value aligned with the registry", () => {
		const registryParticipation = Object.fromEntries(
			registry.map((entry) => [entry.name, entry.schemeParticipation]),
		);

		expect(PIE_THEME_SCHEME_PARTICIPATION).toEqual(registryParticipation);
	});

	test("built-in definitions and generated CSS use exactly required scheme tokens", () => {
		const registeredNames = new Set(registry.map((entry) => entry.name));
		const cssSchemeTokens = new Set(extractCssDeclarations(colorSchemesCss));

		expect([...cssSchemeTokens].sort()).toEqual(requiredSchemeTokens);
		for (const scheme of listBuiltInColorSchemeDefinitions()) {
			expect(Object.keys(scheme.variables).sort(), scheme.id).toEqual(
				requiredSchemeTokens,
			);
			for (const token of Object.keys(scheme.variables)) {
				expect(registeredNames.has(token), `${token} from ${scheme.id}`).toBe(
					true,
				);
			}
		}
	});

	test("component-public inline trigger hooks are documented and registered", () => {
		for (const token of requiredComponentPublicTokens) {
			const entry = entriesByName.get(token);

			expect(
				entry,
				`${token} must be listed in token-registry.json`,
			).toBeDefined();
			expect(entry?.scope).toBe("component-public");
			expect(entry?.status).toBe("active");
			expect(entry?.documentedIn?.length).toBeGreaterThan(0);
		}
	});

	test("known broad-pass decision tokens are explicit, not accidental", () => {
		for (const token of requiredDecisionGateTokens) {
			const entry = entriesByName.get(token);

			expect(
				entry,
				`${token} must have an explicit registry decision`,
			).toBeDefined();
			expect([
				"canonical-semantic",
				"component-public",
				"legacy",
				"unsupported",
			]).toContain(entry?.scope);
			expect(["active", "planned", "intentional-gap"]).toContain(entry?.status);
		}
	});

	test("focus ring alias falls through the canonical focus chain", () => {
		expect(componentsCss.replace(/\s+/g, "")).toContain(
			"--pie-focus-ring-color,var(--pie-focus-outline,var(--pie-button-focus-outline,",
		);
	});
});
