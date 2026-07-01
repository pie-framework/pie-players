import { describe, expect, test } from "bun:test";

import { BUILTIN_PIE_COLOR_SCHEMES } from "../src/color-schemes";
import { DARK_THEME_VARS, LIGHT_THEME_VARS } from "../src/theme-defaults";

type TokenScope =
	| "canonical-semantic"
	| "component-public"
	| "package-private"
	| "legacy"
	| "unsupported";

type TokenStatus = "active" | "deprecated" | "planned" | "intentional-gap";

type TokenRegistryEntry = {
	name: `--pie-${string}`;
	owner: `@pie-players/${string}`;
	scope: TokenScope;
	category: string;
	status: TokenStatus;
	definedIn: string[];
	documentedIn: string[];
	fallbackPolicy: string;
};

const registry = (await Bun.file(
	new URL("../src/token-registry.json", import.meta.url),
).json()) as TokenRegistryEntry[];

const entriesByName = new Map(registry.map((entry) => [entry.name, entry]));

const canonicalDefaultTokens = Object.keys(LIGHT_THEME_VARS).sort();
const darkDefaultTokens = Object.keys(DARK_THEME_VARS).sort();

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
	test("registry entries use the expected shape", () => {
		expect(registry.length).toBeGreaterThan(0);

		for (const entry of registry) {
			expect(entry.name).toMatch(/^--pie-[a-z0-9-]+$/);
			expect(entry.owner).toMatch(/^@pie-players\/[a-z0-9-]+/);
			expect(entry.category.trim()).not.toBe("");
			expect(entry.fallbackPolicy.trim()).not.toBe("");
			expect(entry.definedIn.length).toBeGreaterThan(0);
			expect(entry.documentedIn.length).toBeGreaterThan(0);
		}
	});

	test("canonical theme defaults are registered as active semantic tokens", () => {
		for (const token of canonicalDefaultTokens) {
			const entry = entriesByName.get(token as `--pie-${string}`);

			expect(
				entry,
				`${token} must be listed in token-registry.json`,
			).toBeDefined();
			expect(entry?.owner).toBe("@pie-players/pie-theme");
			expect(entry?.scope).toBe("canonical-semantic");
			expect(entry?.status).toBe("active");
			expect(entry?.definedIn).toContain(
				"packages/theme/src/theme-defaults.ts",
			);
			expect(entry?.documentedIn).toContain("packages/theme/README.md");
		}
	});

	test("light and dark runtime defaults expose the same token set", () => {
		expect(darkDefaultTokens).toEqual(canonicalDefaultTokens);
	});

	test("active canonical registry entries are backed by runtime defaults", () => {
		const canonicalRuntimeSet = new Set(canonicalDefaultTokens);
		const activeCanonicalEntries = registry.filter(
			(entry) =>
				entry.owner === "@pie-players/pie-theme" &&
				entry.scope === "canonical-semantic" &&
				entry.status === "active",
		);

		for (const entry of activeCanonicalEntries) {
			expect(
				canonicalRuntimeSet.has(entry.name),
				`${entry.name} is active canonical but missing from theme-defaults.ts`,
			).toBe(true);
		}
	});

	test("tokens.css stays in parity with runtime theme defaults", () => {
		const cssTokenSet = new Set(extractCssDeclarations(tokensCss));

		expect([...cssTokenSet].sort()).toEqual(canonicalDefaultTokens);
	});

	test("color scheme CSS and TS overrides use registered tokens", () => {
		const registeredNames = new Set(registry.map((entry) => entry.name));
		const cssSchemeTokens = new Set(extractCssDeclarations(colorSchemesCss));

		for (const token of cssSchemeTokens) {
			expect(
				registeredNames.has(token as `--pie-${string}`),
				`${token} from color-schemes.css`,
			).toBe(true);
		}

		for (const scheme of BUILTIN_PIE_COLOR_SCHEMES) {
			for (const token of Object.keys(scheme.variables)) {
				expect(
					registeredNames.has(token as `--pie-${string}`),
					`${token} from ${scheme.id}`,
				).toBe(true);
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
			expect(entry?.documentedIn.length).toBeGreaterThan(0);
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
