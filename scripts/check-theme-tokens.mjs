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
	"--pie-scrollbar-thumb",
	"--pie-scrollbar-thumb-hover",
	"--pie-scrollbar-track",
	"--pie-section-player-focus-outline",
	"--pie-selected-button-background",
	"--pie-selected-button-border",
	"--pie-shadow",
	"--pie-surface",
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

export function checkThemeTokens(root = DEFAULT_ROOT) {
	const failures = [];

	checkRootScript(root, failures);

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
