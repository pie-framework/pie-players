#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_ROOT = process.cwd();
const THEME_DEFAULTS_PATH = "packages/theme/src/theme-defaults.ts";
const TOKENS_CSS_PATH = "packages/theme/src/tokens.css";
const COLOR_SCHEMES_TS_PATH = "packages/theme/src/color-schemes.ts";
const COLOR_SCHEMES_CSS_PATH = "packages/theme/src/color-schemes.css";
const TOKEN_REGISTRY_PATH = "packages/theme/src/token-registry.json";

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

const PACKAGE_PRIVATE_SOURCE_TOKENS = new Set([
	"--pie-annotation-blue-highlight",
	"--pie-annotation-green-highlight",
	"--pie-annotation-orange-highlight",
	"--pie-annotation-pink-highlight",
	"--pie-annotation-yellow-highlight",
	"--pie-elements-ng-root",
	"--pie-font-family",
	"--pie-header-text",
	"--pie-scrollbar-thumb",
	"--pie-scrollbar-thumb-hover",
	"--pie-scrollbar-track",
	"--pie-section-player-focus-outline",
	"--pie-shadow",
	"--pie-surface",
	"--pie-text-light",
	"--pie-tts-line-highlight",
	"--pie-tts-sentence-highlight",
	"--pie-tts-word-highlight",
	"--pie-tts-word-shadow",
	"--pie-tts-word-underline",
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

function extractObjectTokenKeys(source, constName, failures) {
	const start = source.indexOf(`export const ${constName}`);
	if (start === -1) {
		failures.push(
			`[theme-tokens] ${constName} not found in ${THEME_DEFAULTS_PATH}`,
		);
		return new Set();
	}
	const end = source.indexOf("\n};", start);
	if (end === -1) {
		failures.push(
			`[theme-tokens] could not parse ${constName} in ${THEME_DEFAULTS_PATH}`,
		);
		return new Set();
	}
	return extractCssDeclarations(source.slice(start, end));
}

function assertSameSet(failures, label, actual, expected) {
	const actualSet = new Set(actual);
	const expectedSet = new Set(expected);
	const missing = formatSetDifference(expectedSet, actualSet);
	const extra = formatSetDifference(actualSet, expectedSet);
	if (missing || extra) {
		failures.push(
			`[theme-tokens] ${label} do not match LIGHT_THEME_VARS` +
				`${missing ? `; missing: ${missing}` : ""}` +
				`${extra ? `; extra: ${extra}` : ""}`,
		);
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
	if (!script || !script.includes("check-theme-tokens.mjs")) {
		failures.push(
			'[theme-tokens] package.json scripts must include "check:theme-tokens" running scripts/check-theme-tokens.mjs',
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
	const themeDefaults = readText(root, THEME_DEFAULTS_PATH, failures);
	const lightTokens = extractObjectTokenKeys(
		themeDefaults,
		"LIGHT_THEME_VARS",
		failures,
	);
	const darkTokens = extractObjectTokenKeys(
		themeDefaults,
		"DARK_THEME_VARS",
		failures,
	);
	assertSameSet(failures, "DARK_THEME_VARS", darkTokens, lightTokens);

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
	);

	const tokensCss = readText(root, TOKENS_CSS_PATH, failures);
	assertSameSet(
		failures,
		"tokens.css declarations",
		extractCssDeclarations(tokensCss),
		lightTokens,
	);

	const registeredNames = new Set(registry.map((entry) => entry.name));
	for (const [relPath, tokens] of [
		[
			COLOR_SCHEMES_TS_PATH,
			extractPieTokens(readText(root, COLOR_SCHEMES_TS_PATH, failures)),
		],
		[
			COLOR_SCHEMES_CSS_PATH,
			extractCssDeclarations(readText(root, COLOR_SCHEMES_CSS_PATH, failures)),
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
