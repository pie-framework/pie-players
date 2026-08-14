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

const NDS_MOUNT_WITH_BRIDGE = [
	'<nds-icon-button variant="tertiary"></nds-icon-button>',
	"<style>",
	"nds-icon-button {",
	"  --color-interactive-blue: var(--pie-button-bg, #222);",
	"  --color-new-gray: var(--pie-background-dark, #f3f5f7);",
	"  --color-primary-white: var(--pie-white, #ffffff);",
	"  --color-primary-black: var(--pie-text, #000000);",
	"  --color-focus-blue: var(--pie-button-focus-outline, #2b87ff);",
	"}",
	"</style>",
].join("\n");

function createFixtureRoot() {
	const root = mkdtempSync(path.join(tmpdir(), "pie-theme-tokens-"));

	write(
		root,
		"package.json",
		JSON.stringify({
			scripts: {
				"check:theme-tokens":
					"bun ./scripts/check-theme-tokens.mjs && bun run --cwd packages/theme check:generated-css",
			},
		}),
	);
	write(
		root,
		"packages/theme/src/theme-definitions.ts",
		[
			"const LIGHT_BASE_THEME = {",
			'  "--pie-background": "#fff",',
			'  "--pie-button-bg": "#fff",',
			"};",
			"const DARK_BASE_THEME = {",
			'  "--pie-background": "#000",',
			'  "--pie-button-bg": "#111",',
			"};",
			"const BUILT_IN_COLOR_SCHEMES = [{ variables: {",
			'  "--pie-background": "#fff",',
			'  "--pie-button-bg": "#fff",',
			'  "--pie-tool-example-border": "#000",',
			"} }];",
		].join("\n"),
	);
	write(
		root,
		"packages/theme/src/tokens.css",
		':root { --pie-background: #fff; --pie-button-bg: #fff; --pie-tool-example-border: #000; }\n[data-theme="dark"] { --pie-background: #000; --pie-button-bg: #111; --pie-tool-example-border: #fff; }\n',
	);
	write(
		root,
		"packages/theme/src/scheme-participation.ts",
		[
			"export const PIE_THEME_SCHEME_PARTICIPATION = {",
			'  "--pie-background": "required",',
			'  "--pie-button-bg": "required",',
			'  "--pie-tool-example-border": "required",',
			'  "--pie-tool-trigger-active-background": "optional",',
			'  "--pie-button-background-color": "excluded",',
			"} as const;",
		].join("\n"),
	);
	write(
		root,
		"packages/theme/src/color-schemes.css",
		'[data-color-scheme="black-on-white"] { --pie-background: #fff; --pie-button-bg: #fff; --pie-tool-example-border: #000; }\n',
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
				schemeParticipation: "required",
				definedIn: ["packages/theme/src/theme-definitions.ts"],
				documentedIn: ["packages/theme/README.md"],
				fallbackPolicy: "Canonical background token.",
			},
			{
				name: "--pie-button-bg",
				owner: "@pie-players/pie-theme",
				scope: "canonical-semantic",
				category: "button",
				status: "active",
				schemeParticipation: "required",
				definedIn: ["packages/theme/src/theme-definitions.ts"],
				documentedIn: ["packages/theme/README.md"],
				fallbackPolicy: "Canonical button background token.",
			},
			{
				name: "--pie-tool-example-border",
				owner: "@pie-players/pie-tool-example",
				scope: "component-public",
				category: "tool-boundary",
				status: "active",
				schemeParticipation: "required",
				definedIn: ["packages/theme/src/theme-definitions.ts"],
				documentedIn: ["packages/tool-example/README.md"],
				fallbackPolicy: "Accessibility boundary included in every scheme.",
			},
			{
				name: "--pie-tool-trigger-active-background",
				owner: "@pie-players/pie-tool-example",
				scope: "component-public",
				category: "tool-trigger",
				status: "active",
				schemeParticipation: "optional",
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
				schemeParticipation: "excluded",
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
		"--pie-tool-example-border, --pie-tool-trigger-active-background, and --pie-button-background-color are documented.\n",
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

	test("accepts a mount that bridges the vendored NDS palette", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/tool-example/tool-example-nds.svelte",
			NDS_MOUNT_WITH_BRIDGE,
		);

		const ndsFailures = checkThemeTokens(root).filter((failure) =>
			failure.includes("nds-icon-button"),
		);

		expect(ndsFailures).toEqual([]);
	});

	test("flags a mount that leaves the NDS palette unbridged", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/tool-example/tool-example-nds.svelte",
			'<nds-icon-button variant="tertiary"></nds-icon-button>\n<style></style>\n',
		);

		const failures = checkThemeTokens(root)
			.filter((failure) => failure.includes("nds-icon-button"))
			.join("\n");

		expect(failures).toContain("does not bridge `--color-new-gray`");
		expect(failures).toContain("does not bridge `--color-focus-blue`");
		expect(failures).toContain("does not remap --color-interactive-blue");
	});

	test("ignores files that only name nds-icon-button in prose", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/tool-example/tool-example-docs.svelte",
			"<script>\n// Controls render <nds-icon-button> only when the host opts in.\n</script>\n",
		);

		const ndsFailures = checkThemeTokens(root).filter((failure) =>
			failure.includes("nds-icon-button"),
		);

		expect(ndsFailures).toEqual([]);
	});

	test("requires the root command to verify generated CSS bytes", () => {
		const root = createFixtureRoot();
		write(
			root,
			"package.json",
			JSON.stringify({
				scripts: {
					"check:theme-tokens": "bun ./scripts/check-theme-tokens.mjs",
				},
			}),
		);

		expect(checkThemeTokens(root).join("\n")).toContain(
			"pie-theme check:generated-css command",
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
			"tokens.css declarations do not match Base Theme token set",
		);
	});

	test("rejects generated scheme-participation drift", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/theme/src/scheme-participation.ts",
			[
				"export const PIE_THEME_SCHEME_PARTICIPATION = {",
				'  "--pie-background": "optional",',
				'  "--pie-button-bg": "required",',
				'  "--pie-tool-example-border": "required",',
				'  "--pie-tool-trigger-active-background": "optional",',
				'  "--pie-button-background-color": "excluded",',
				"} as const;",
			].join("\n"),
		);

		expect(checkThemeTokens(root).join("\n")).toContain(
			"--pie-background scheme participation is optional",
		);
	});

	test("rejects non-required tokens in generated color-scheme CSS", () => {
		const root = createFixtureRoot();
		write(
			root,
			"packages/theme/src/color-schemes.css",
			'[data-color-scheme="black-on-white"] { --pie-background: #fff; --pie-button-bg: #fff; --pie-tool-example-border: #000; --pie-tool-trigger-active-background: #eee; }\n',
		);

		expect(checkThemeTokens(root).join("\n")).toContain(
			"color-schemes.css declarations do not match required scheme tokens",
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
