import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { checkThemeTokens } from "../check-theme-tokens.mjs";

function write(root, relPath, content) {
	const absPath = path.join(root, relPath);
	mkdirSync(path.dirname(absPath), { recursive: true });
	writeFileSync(absPath, content);
}

function createFixtureRoot() {
	const root = mkdtempSync(path.join(tmpdir(), "pie-theme-tokens-"));

	write(
		root,
		"package.json",
		JSON.stringify({
			scripts: {
				"check:theme-tokens": "bun ./scripts/check-theme-tokens.mjs",
			},
		}),
	);
	write(
		root,
		"packages/theme/src/theme-defaults.ts",
		[
			"export const LIGHT_THEME_VARS = {",
			'  "--pie-background": "#fff",',
			'  "--pie-button-bg": "#fff",',
			"};",
			"export const DARK_THEME_VARS = {",
			'  "--pie-background": "#000",',
			'  "--pie-button-bg": "#111",',
			"};",
		].join("\n"),
	);
	write(
		root,
		"packages/theme/src/tokens.css",
		':root { --pie-background: #fff; --pie-button-bg: #fff; }\n[data-theme="dark"] { --pie-background: #000; --pie-button-bg: #111; }\n',
	);
	write(
		root,
		"packages/theme/src/color-schemes.ts",
		'export const BUILTIN_PIE_COLOR_SCHEMES = [{ variables: { "--pie-background": "#fff" } }];\n',
	);
	write(
		root,
		"packages/theme/src/color-schemes.css",
		'[data-color-scheme="black-on-white"] { --pie-background: #fff; }\n',
	);
	write(
		root,
		"packages/theme/src/token-registry.json",
		JSON.stringify([
			{
				name: "--pie-background",
				owner: "@pie-players/pie-theme",
				scope: "canonical-semantic",
				category: "surface",
				status: "active",
				definedIn: ["packages/theme/src/theme-defaults.ts"],
				documentedIn: ["packages/theme/README.md"],
				fallbackPolicy: "Canonical background token.",
			},
			{
				name: "--pie-button-bg",
				owner: "@pie-players/pie-theme",
				scope: "canonical-semantic",
				category: "button",
				status: "active",
				definedIn: ["packages/theme/src/theme-defaults.ts"],
				documentedIn: ["packages/theme/README.md"],
				fallbackPolicy: "Canonical button background token.",
			},
			{
				name: "--pie-tool-trigger-active-background",
				owner: "@pie-players/pie-tool-example",
				scope: "component-public",
				category: "tool-trigger",
				status: "active",
				definedIn: ["packages/tool-example/tool-example.svelte"],
				documentedIn: ["packages/tool-example/README.md"],
				fallbackPolicy: "Component active trigger background token.",
			},
			{
				name: "--pie-button-background-color",
				owner: "@pie-players/pie-tool-example",
				scope: "legacy",
				category: "button",
				status: "active",
				definedIn: ["packages/tool-example/tool-example.svelte"],
				documentedIn: ["packages/tool-example/README.md"],
				fallbackPolicy: "Legacy alias that falls back through --pie-button-bg.",
			},
		]),
	);
	write(
		root,
		"packages/theme/README.md",
		"Theme docs mention canonical tokens generally.\n",
	);
	write(
		root,
		"packages/tool-example/README.md",
		"--pie-tool-trigger-active-background and --pie-button-background-color are documented.\n",
	);
	write(
		root,
		"packages/tool-example/tool-example.svelte",
		"<style>.trigger { background: var(--pie-tool-trigger-active-background, var(--pie-button-background-color, var(--pie-button-bg, #fff))); }</style>\n",
	);

	return root;
}

describe("check-theme-tokens", () => {
	test("allows registry entries that are backed by source, docs, and canonical parity", () => {
		expect(checkThemeTokens(createFixtureRoot())).toEqual([]);
	});

	test("requires the root check:theme-tokens command", () => {
		const root = createFixtureRoot();
		write(root, "package.json", JSON.stringify({ scripts: {} }));

		expect(checkThemeTokens(root).join("\n")).toContain(
			'package.json scripts must include "check:theme-tokens"',
		);
	});

	test("requires component-public and legacy tokens to be documented and used", () => {
		const root = createFixtureRoot();
		write(root, "packages/tool-example/README.md", "No token docs here.\n");
		write(
			root,
			"packages/tool-example/tool-example.svelte",
			"<style></style>\n",
		);

		const failures = checkThemeTokens(root).join("\n");

		expect(failures).toContain(
			"--pie-tool-trigger-active-background documentedIn path does not mention the token",
		);
		expect(failures).toContain(
			"--pie-tool-trigger-active-background definedIn path does not mention the token",
		);
	});

	test("rejects canonical tokens that drift between TS and CSS defaults", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/theme/src/tokens.css",
			":root { --pie-background: #fff; }\n",
		);

		expect(checkThemeTokens(root).join("\n")).toContain(
			"tokens.css declarations do not match LIGHT_THEME_VARS",
		);
	});

	test("rejects unregistered public-looking source token usage", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/tool-example/tool-example.svelte",
			"<style>.trigger { color: var(--pie-unregistered-public-token, #000); }</style>\n",
		);

		expect(checkThemeTokens(root).join("\n")).toContain(
			"--pie-unregistered-public-token is used in source but is not registered",
		);
	});
});
