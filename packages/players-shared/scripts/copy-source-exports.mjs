#!/usr/bin/env bun
// Copy Svelte source-export files into dist/.
//
// The ./components/*.svelte and ./i18n/use-i18n* exports ship as raw
// Svelte / Svelte-5-runes sources (tsc cannot compile .svelte.ts runes
// correctly; the consumer's Svelte plugin processes them at consume time).
//
// We stage them under dist/ (rather than src/) so every relative import
// inside the shipped .svelte files (for example ../pie/logger.js,
// ../ui/focus-trap.js) resolves against tsc-compiled dist siblings that
// are already in the tarball. Shipping them under src/ makes those
// imports unresolvable for any consumer that isn't a workspace sibling
// with the full src/ tree available.
//
// Files copied (kept as raw source):
//   src/components/{*.svelte,index.ts}       -> dist/components/
//   src/i18n/use-i18n.svelte.ts              -> dist/i18n/
//   src/i18n/use-i18n-standalone.svelte.ts   -> dist/i18n/
//
// Stale tsc artifacts for the two .svelte.ts files (use-i18n.svelte.js,
// .d.ts and map siblings) are removed to keep the publish surface clean.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = dirname(__dirname);
const SRC = join(PKG_ROOT, "src");
const DIST = join(PKG_ROOT, "dist");

const ensureDir = (path) => {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
};

const copyOne = (relativePath) => {
	const from = join(SRC, relativePath);
	const to = join(DIST, relativePath);
	if (!existsSync(from)) {
		throw new Error(`copy-source-exports: missing source file ${from}`);
	}
	ensureDir(dirname(to));
	cpSync(from, to);
};

const STALE_TSC_ARTIFACT_NAMES = new Map([
	[
		"i18n",
		new Set([
			"use-i18n.svelte.js",
			"use-i18n.svelte.js.map",
			"use-i18n.svelte.d.ts",
			"use-i18n.svelte.d.ts.map",
			"use-i18n-standalone.svelte.js",
			"use-i18n-standalone.svelte.js.map",
			"use-i18n-standalone.svelte.d.ts",
			"use-i18n-standalone.svelte.d.ts.map",
		]),
	],
	[
		"ui",
		new Set([
			"use-promise.svelte.js",
			"use-promise.svelte.js.map",
			"use-promise.svelte.d.ts",
			"use-promise.svelte.d.ts.map",
		]),
	],
]);

const removeStaleTscArtifacts = () => {
	for (const [subdir, names] of STALE_TSC_ARTIFACT_NAMES) {
		const dir = join(DIST, subdir);
		if (!existsSync(dir)) continue;
		for (const entry of readdirSync(dir)) {
			if (names.has(entry)) {
				rmSync(join(dir, entry));
			}
		}
	}
};

const svelteComponents = [
	"components/PieItemPlayer.svelte",
	"components/PiePreviewLayout.svelte",
	"components/PiePreviewToggle.svelte",
	"components/PieSpinner.svelte",
	"components/ToolSettingsButton.svelte",
	"components/ToolSettingsPanel.svelte",
];

const componentsBarrel = ["components/index.ts"];

const i18nRunes = [
	"i18n/use-i18n.svelte.ts",
	"i18n/use-i18n-standalone.svelte.ts",
];

const uiRunes = ["ui/use-promise.svelte.ts"];

removeStaleTscArtifacts();

for (const rel of [
	...svelteComponents,
	...componentsBarrel,
	...i18nRunes,
	...uiRunes,
]) {
	copyOne(rel);
}

const countSvelte = svelteComponents.length;
const countBarrel = componentsBarrel.length;
const countRunes = i18nRunes.length + uiRunes.length;
console.log(
	`[copy-source-exports] staged ${countSvelte} svelte + ${countBarrel} ts + ${countRunes} svelte.ts source files into dist/`,
);
