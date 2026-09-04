#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_ROOT = process.cwd();
const THEME_DEFINITIONS_PATH = "packages/theme/src/theme-definitions.ts";
const TOKENS_CSS_PATH = "packages/theme/src/tokens.css";
const COLOR_SCHEMES_CSS_PATH = "packages/theme/src/color-schemes.css";
const SCHEME_PARTICIPATION_PATH = "packages/theme/src/scheme-participation.ts";
const TOKEN_REGISTRY_PATH = "packages/theme/src/token-registry.json";

const VALID_SCHEME_PARTICIPATION = new Set([
	"required",
	"optional",
	"excluded",
]);

const VALID_SOURCE_EXTENSIONS = new Set([
	".css",
	".js",
	".mjs",
	".svelte",
	".ts",
	".tsx",
]);

const SKIP_DIR_NAMES = new Set([
	".git",
	".svelte-kit",
	".turbo",
	"build",
	"dist",
	"node_modules",
]);

const SOURCE_USAGE_ROOTS = ["packages"];

/**
 * Internal `--pie-*` names that source may use without a token-registry entry.
 *
 * The registry is the *host contract*: what a host may theme and rely on. These
 * are implementation details — sizing handoffs, zoom compensation, per-tool
 * accents — so recording them here keeps them out of it.
 *
 * Prefer this list over a registry entry for anything internal. A full entry
 * costs ~15 lines including a hand-written fallbackPolicy, and writing one for a
 * token no host should touch inflates the contract without protecting anything:
 * `package-private` records intent, it does not stop a host setting the value.
 * Most of these are only ever read as `var(--x, fallback)` and never declared,
 * so they are settable whether or not we bless them.
 *
 * Use a `package-private` registry entry instead when the token genuinely needs
 * explaining — `--pie-content-styles` is a presence sentinel, and the
 * section-player layout handoffs are set from component props. Those earn the
 * prose. A bare accent colour does not.
 */
const PACKAGE_PRIVATE_SOURCE_TOKENS = new Set([
	"--pie-annotation-blue-highlight",
	"--pie-annotation-green-highlight",
	"--pie-annotation-orange-highlight",
	"--pie-annotation-pink-highlight",
	"--pie-annotation-underline",
	"--pie-annotation-underline-dark",
	"--pie-annotation-yellow-highlight",
	"--pie-answer-eliminator-image-strike-casing-color",
	"--pie-answer-eliminator-strike-paint",
	"--pie-answer-eliminator-toggle-color",
	"--pie-calculator-button-color",
	"--pie-calculator-button-size",
	"--pie-calculator-button-size-lg",
	"--pie-calculator-button-size-sm",
	"--pie-elements-ng-root",
	"--pie-font-family",
	"--pie-header-text",
	"--pie-loading-accent",
	"--pie-scrollbar-thumb",
	"--pie-scrollbar-thumb-hover",
	"--pie-scrollbar-track",
	"--pie-section-player-focus-outline",
	"--pie-selected-button-background",
	"--pie-selected-button-border",
	"--pie-shadow",
	"--pie-text-light",
	"--pie-tool-line-reader-band-height",
	"--pie-tool-line-reader-outline-color",
	"--pie-tool-line-reader-side-width",
	"--pie-tool-shell-zoom-comp",
	"--pie-toolbar-zoom-comp",
	"--pie-tts-button-color",
	"--pie-tts-card-border",
	"--pie-tts-inline-muted-color",
	"--pie-tts-left-aligned-panel-width",
	"--pie-tts-line-highlight",
	"--pie-tts-menu-shadow",
	"--pie-tts-selected-bg",
	"--pie-tts-sentence-highlight",
	"--pie-tts-trigger-shadow",
	"--pie-tts-word-highlight",
	"--pie-tts-word-shadow",
	"--pie-tts-word-underline",
	"--pie-tts-zoom-comp",
]);

function rel(root, absPath) {
	return path.relative(root, absPath).split(path.sep).join("/");
}

function readText(root, relPath, failures) {
	const absPath = path.join(root, relPath);
	if (!existsSync(absPath)) {
		failures.push(`[theme-tokens] missing required path: ${relPath}`);
		return "";
	}
	return readFileSync(absPath, "utf8");
}

function readJson(root, relPath, failures) {
	const text = readText(root, relPath, failures);
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch (error) {
		failures.push(
			`[theme-tokens] invalid JSON in ${relPath}: ${error.message}`,
		);
		return null;
	}
}

function sortValues(values) {
	return [...values].sort();
}

function formatSetDifference(left, right) {
	return sortValues([...left].filter((value) => !right.has(value))).join(", ");
}

function extractPieTokens(content) {
	return new Set(
		[...content.matchAll(/--pie-[a-z0-9]+(?:-[a-z0-9]+)*/g)].map(
			(match) => match[0],
		),
	);
}

function extractCssDeclarations(content) {
	return new Set(
		[...content.matchAll(/(--pie-[a-z0-9]+(?:-[a-z0-9]+)*)(?:["'])?\s*:/g)].map(
			(match) => match[1],
		),
	);
}

function extractObjectTokenKeys(source, sourcePath, constName, failures) {
	const declaration = new RegExp(
		`(?:export\\s+)?const\\s+${constName}\\b`,
	).exec(source);
	const start = declaration?.index ?? -1;
	if (start === -1) {
		failures.push(`[theme-tokens] ${constName} not found in ${sourcePath}`);
		return new Set();
	}
	const end = source.indexOf("\n};", start);
	if (end === -1) {
		failures.push(
			`[theme-tokens] could not parse ${constName} in ${sourcePath}`,
		);
		return new Set();
	}
	return extractCssDeclarations(source.slice(start, end));
}

function extractSchemeParticipation(source, failures) {
	const declaration = source.indexOf("PIE_THEME_SCHEME_PARTICIPATION");
	const start = source.indexOf("{", declaration);
	const end = source.indexOf("} as const", start);
	if (declaration === -1 || start === -1 || end === -1) {
		failures.push(
			`[theme-tokens] could not parse PIE_THEME_SCHEME_PARTICIPATION in ${SCHEME_PARTICIPATION_PATH}`,
		);
		return new Map();
	}

	const participation = new Map();
	for (const match of source
		.slice(start, end)
		.matchAll(
			/["'](--pie-[a-z0-9]+(?:-[a-z0-9]+)*)["']\s*:\s*["'](required|optional|excluded)["']/g,
		)) {
		if (participation.has(match[1])) {
			failures.push(
				`[theme-tokens] duplicate ${match[1]} in ${SCHEME_PARTICIPATION_PATH}`,
			);
		}
		participation.set(match[1], match[2]);
	}
	return participation;
}

function assertSameSet(failures, label, actual, expected, expectedLabel) {
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);
	const missing = formatSetDifference(expectedSet, actualSet);
	const extra = formatSetDifference(actualSet, expectedSet);
	if (missing || extra) {
		failures.push(
			`[theme-tokens] ${label} do not match ${expectedLabel}` +
				`${missing ? `; missing: ${missing}` : ""}` +
				`${extra ? `; extra: ${extra}` : ""}`,
		);
	}
}

function assertSameParticipation(failures, registry, generated) {
	const registryByName = new Map();
	for (const entry of registry) {
		if (registryByName.has(entry.name)) {
			failures.push(
				`[theme-tokens] duplicate registry entry for ${entry.name}`,
			);
		}
		registryByName.set(entry.name, entry.schemeParticipation);
		if (!VALID_SCHEME_PARTICIPATION.has(entry.schemeParticipation)) {
			failures.push(
				`[theme-tokens] ${entry.name} has invalid schemeParticipation: ${String(entry.schemeParticipation)}`,
			);
		}
	}

	assertSameSet(
		failures,
		"generated scheme participation keys",
		generated.keys(),
		registryByName.keys(),
		"token-registry.json entries",
	);
	for (const [token, value] of registryByName) {
		if (generated.has(token) && generated.get(token) !== value) {
			failures.push(
				`[theme-tokens] ${token} scheme participation is ${generated.get(token)} in ${SCHEME_PARTICIPATION_PATH} but ${value} in ${TOKEN_REGISTRY_PATH}`,
			);
		}
	}
}

function walkFiles(root, relDir, visitor) {
	const absDir = path.join(root, relDir);
	if (!existsSync(absDir)) return;

	for (const entry of readdirSync(absDir)) {
		const absPath = path.join(absDir, entry);
		const stats = statSync(absPath);
		if (stats.isDirectory()) {
			if (SKIP_DIR_NAMES.has(entry)) continue;
			walkFiles(root, rel(root, absPath), visitor);
			continue;
		}
		visitor(absPath);
	}
}

function isSourceUsageFile(absPath) {
	const ext = path.extname(absPath);
	if (!VALID_SOURCE_EXTENSIONS.has(ext)) return false;
	const normalized = absPath.split(path.sep).join("/");
	return !normalized.includes("/tests/") && !normalized.includes("/test/");
}

function checkRootScript(root, failures) {
	const packageJson = readJson(root, "package.json", failures);
	const script = packageJson?.scripts?.["check:theme-tokens"];
	if (
		!script ||
		!script.includes("check-theme-tokens.mjs") ||
		!script.includes("check:generated-css")
	) {
		failures.push(
			'[theme-tokens] package.json scripts must include "check:theme-tokens" running scripts/check-theme-tokens.mjs and the pie-theme check:generated-css command',
		);
	}
}

function checkRegistryPaths(root, registry, failures) {
	for (const entry of registry) {
		for (const relPath of entry.definedIn || []) {
			const content = readText(root, relPath, failures);
			if (entry.status === "active" && !content.includes(entry.name)) {
				failures.push(
					`[theme-tokens] ${entry.name} definedIn path does not mention the token: ${relPath}`,
				);
			}
		}

		if (entry.scope !== "component-public" && entry.scope !== "legacy") {
			continue;
		}

		for (const relPath of entry.documentedIn || []) {
			const content = readText(root, relPath, failures);
			if (!content.includes(entry.name)) {
				failures.push(
					`[theme-tokens] ${entry.name} documentedIn path does not mention the token: ${relPath}`,
				);
			}
		}
	}
}

function checkCanonicalParity(root, registry, failures) {
	const themeDefinitions = readText(root, THEME_DEFINITIONS_PATH, failures);
	const lightTokens = extractObjectTokenKeys(
		themeDefinitions,
		THEME_DEFINITIONS_PATH,
		"LIGHT_BASE_THEME",
		failures,
	);
	const darkTokens = extractObjectTokenKeys(
		themeDefinitions,
		THEME_DEFINITIONS_PATH,
		"DARK_BASE_THEME",
		failures,
	);
	assertSameSet(
		failures,
		"DARK_BASE_THEME",
		darkTokens,
		lightTokens,
		"LIGHT_BASE_THEME",
	);

	const activeCanonical = registry
		.filter(
			(entry) =>
				entry.scope === "canonical-semantic" && entry.status === "active",
		)
		.map((entry) => entry.name);
	assertSameSet(
		failures,
		"active canonical registry entries",
		activeCanonical,
		lightTokens,
		"LIGHT_BASE_THEME",
	);

	const requiredSchemeTokens = registry
		.filter((entry) => entry.schemeParticipation === "required")
		.map((entry) => entry.name);
	const requiredNonCanonicalTokens = registry
		.filter(
			(entry) =>
				entry.schemeParticipation === "required" &&
				!(entry.scope === "canonical-semantic" && entry.status === "active"),
		)
		.map((entry) => entry.name);
	const expectedBaseTokens = new Set([
		...lightTokens,
		...requiredNonCanonicalTokens,
	]);

	const tokensCss = readText(root, TOKENS_CSS_PATH, failures);
	assertSameSet(
		failures,
		"tokens.css declarations",
		extractCssDeclarations(tokensCss),
		expectedBaseTokens,
		"Base Theme token set",
	);
	const colorSchemesCss = readText(root, COLOR_SCHEMES_CSS_PATH, failures);
	assertSameSet(
		failures,
		"color-schemes.css declarations",
		extractCssDeclarations(colorSchemesCss),
		requiredSchemeTokens,
		"required scheme tokens",
	);

	const participation = extractSchemeParticipation(
		readText(root, SCHEME_PARTICIPATION_PATH, failures),
		failures,
	);
	assertSameParticipation(failures, registry, participation);

	const registeredNames = new Set(registry.map((entry) => entry.name));
	for (const [relPath, tokens] of [
		[THEME_DEFINITIONS_PATH, extractPieTokens(themeDefinitions)],
		[COLOR_SCHEMES_CSS_PATH, extractCssDeclarations(colorSchemesCss)],
		[
			SCHEME_PARTICIPATION_PATH,
			extractPieTokens(readText(root, SCHEME_PARTICIPATION_PATH, failures)),
		],
	]) {
		for (const token of tokens) {
			if (!registeredNames.has(token)) {
				failures.push(
					`[theme-tokens] ${token} appears in ${relPath} but is not registered`,
				);
			}
		}
	}
}

function checkSourceUsage(root, registry, failures) {
	const registeredNames = new Set(registry.map((entry) => entry.name));
	const reported = new Set();

	for (const relDir of SOURCE_USAGE_ROOTS) {
		walkFiles(root, relDir, (absPath) => {
			if (!isSourceUsageFile(absPath)) return;
			const relPath = rel(root, absPath);
			if (relPath === TOKEN_REGISTRY_PATH) return;

			const content = readFileSync(absPath, "utf8");
			for (const token of extractPieTokens(content)) {
				if (
					registeredNames.has(token) ||
					PACKAGE_PRIVATE_SOURCE_TOKENS.has(token)
				) {
					continue;
				}
				const key = `${token}:${relPath}`;
				if (reported.has(key)) continue;
				reported.add(key);
				failures.push(
					`[theme-tokens] ${token} is used in source but is not registered or classified as package-private: ${relPath}`,
				);
			}
		});
	}
}

/*
 * The vendored NDS icon button paints from the NDS design-system palette
 * (`--color-*`), which no PIE theme sets. Its own defaults are literals, so an
 * unbridged button keeps a #f3f5f7 pill and a #2b87ff focus ring under every
 * theme — and once its glyph follows the theme, a light glyph lands on that
 * light pill and disappears.
 *
 * The bridge has to be declared at every element that mounts one: the vendored
 * bundle is a build artifact we do not re-author, and some mounts sit inside a
 * shadow root a document stylesheet cannot reach. Mount sites are discovered
 * rather than listed, so a rename or a new mount cannot drop the guard.
 */
const NDS_BRIDGE_DECLARATIONS = [
	"--color-new-gray: var(--pie-background-dark, #f3f5f7);",
	"--color-primary-white: var(--pie-white, #ffffff);",
	"--color-primary-black: var(--pie-text, #000000);",
	"--color-focus-blue: var(--pie-button-focus-outline, #2b87ff);",
];

const NDS_MOUNT_PATTERNS = [
	/<nds-icon-button[\s/>]/,
	/createElement\(\s*["']nds-icon-button["']/,
];

/** Comment text mentions the tag far more often than markup mounts it. */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

function checkNdsPaletteBridge(root, failures) {
	for (const usageRoot of SOURCE_USAGE_ROOTS) {
		walkFiles(root, usageRoot, (absPath) => {
			if (!isSourceUsageFile(absPath)) return;
			const relPath = rel(root, absPath);
			const source = readFileSync(absPath, "utf8");
			if (!source.includes("nds-icon-button")) return;
			const code = stripComments(source);
			if (!NDS_MOUNT_PATTERNS.some((pattern) => pattern.test(code))) return;

			for (const declaration of NDS_BRIDGE_DECLARATIONS) {
				const [property, value] = declaration
					.replace(/;$/, "")
					.split(/:\s(.+)/);
				// The imperative mounts set the same mapping via setProperty().
				const asStyleProperty = `'${property}', '${value}'`;
				if (
					!source.includes(declaration) &&
					!source.includes(asStyleProperty)
				) {
					failures.push(
						`[theme-tokens] ${relPath} mounts nds-icon-button but does not bridge \`${property}\` to a --pie-* token`,
					);
				}
			}
			if (!/--color-interactive-blue:\s*var\(--pie-/.test(source)) {
				failures.push(
					`[theme-tokens] ${relPath} mounts nds-icon-button but does not remap --color-interactive-blue through a --pie-* token`,
				);
			}
		});
	}
}

/*
 * Colours set from JS — an inline style string, a `.style.x =` assignment, a
 * setProperty() call — are invisible to a scan of `<style>` blocks and `.css`
 * files, and that is exactly where the worst offender hid: the floating tool
 * shell's header pinned a light grey strip under themed title text on every
 * dark theme, while every stylesheet in the repo looked clean.
 */
const PAINT_PROPERTIES = new Set([
	"background",
	"background-color",
	"border",
	"border-color",
	"border-top",
	"border-bottom",
	"border-left",
	"border-right",
	"outline",
	"outline-color",
	"color",
	"fill",
	"stroke",
]);

const DECLARATION_IN_STRING = /([a-zA-Z-]+)\s*:\s*([^;"'`]+)/g;

/** `el.style.borderBottom = "..."` and `el.style.setProperty("--x", "...")`. */
const STYLE_ASSIGNMENT =
	/\.style\.(?:setProperty\(\s*["']([^"']+)["']\s*,\s*|([A-Za-z]+)\s*=\s*)(["'])((?:(?!\3).)*)\3/g;

/** `style="..."` in markup, including inside a template literal. */
const STYLE_ATTRIBUTE = /style\s*=\s*(["'])((?:(?!\1).)*)\1/g;

const LITERAL_COLOUR =
	/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(?:white|black|silver|gray|grey|red|blue|green|yellow|orange|purple|pink|brown|navy|teal|olive|maroon|lime|aqua|fuchsia|cyan|magenta|gold|darkred|lightgray|lightgrey|darkgray|darkgrey|dimgray|dimgrey)\b/;

const kebab = (name) => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * Fully transparent rgba() is `transparent` spelled long, and a --pie-* chain's
 * own tail literal is the intended no-theme fallback. Neither is a finding.
 */
function stripInertColours(value) {
	return value
		.replace(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g, "")
		.replace(/var\(\s*--pie-[\s\S]*$/g, "");
}

function collectInlinePaints(source) {
	const paints = [];
	for (const match of source.matchAll(STYLE_ASSIGNMENT)) {
		const [, customProperty, jsProperty, , value] = match;
		// A custom property is a handoff, not a paint: its own consumer decides.
		if (customProperty) continue;
		const property = kebab(jsProperty);
		if (!PAINT_PROPERTIES.has(property)) continue;
		paints.push({ property, value, kind: "style assignment" });
	}
	for (const match of source.matchAll(STYLE_ATTRIBUTE)) {
		for (const declaration of match[2].matchAll(DECLARATION_IN_STRING)) {
			const property = declaration[1].toLowerCase();
			if (!PAINT_PROPERTIES.has(property)) continue;
			paints.push({
				property,
				value: declaration[2],
				kind: "inline style attribute",
			});
		}
	}
	return paints;
}

/*
 * Colours set from JS — an inline style string or a `.style.x =` assignment —
 * are invisible to a scan of `<style>` blocks and `.css` files, which is how a
 * `color: red` error frame in the print player and a `#ddd` element divider in
 * the item player survived a stylesheet audit that found everything else.
 *
 * Bounded deliberately to a *bare* literal. The other shape — a literal sitting
 * behind a registered token that hosts rarely set, which is what left the tool
 * shell's header a light grey strip under themed title text — is not
 * mechanically separable from a legitimate host-tint opt-in, and stays a review
 * question.
 */
function checkInlineStyleLiterals(root, failures) {
	for (const usageRoot of SOURCE_USAGE_ROOTS) {
		walkFiles(root, usageRoot, (absPath) => {
			if (!isSourceUsageFile(absPath)) return;
			const relPath = rel(root, absPath);
			const source = readFileSync(absPath, "utf8");
			if (!source.includes("style")) return;

			for (const { property, value, kind } of collectInlinePaints(source)) {
				if (!LITERAL_COLOUR.test(stripInertColours(value))) continue;
				failures.push(
					`[theme-tokens] ${relPath} sets \`${property}\` to the literal \`${value.trim()}\` from a ${kind}; route it through a --pie-* token with the literal as the fallback`,
				);
			}
		});
	}
}

export function checkThemeTokens(root = DEFAULT_ROOT) {
	const failures = [];

	checkRootScript(root, failures);
	checkNdsPaletteBridge(root, failures);
	checkInlineStyleLiterals(root, failures);

	const registry = readJson(root, TOKEN_REGISTRY_PATH, failures) || [];
	if (!Array.isArray(registry)) {
		failures.push(
			`[theme-tokens] ${TOKEN_REGISTRY_PATH} must contain an array`,
		);
		return failures;
	}

	checkRegistryPaths(root, registry, failures);
	checkCanonicalParity(root, registry, failures);
	checkSourceUsage(root, registry, failures);

	return failures;
}

if (import.meta.main) {
	const failures = checkThemeTokens(DEFAULT_ROOT);

	if (failures.length > 0) {
		console.error(
			`[check-theme-tokens] Found ${failures.length} theme token contract issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(
		"[check-theme-tokens] OK: theme token registry matches source usage",
	);
}
