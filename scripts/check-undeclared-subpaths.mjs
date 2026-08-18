#!/usr/bin/env node

/**
 * Every cross-package `@pie-players/*` import must name a subpath the owning
 * package declares in its `exports` map.
 *
 * A subpath that resolves only through a per-package Vite alias works in a bundle
 * and is absent from the published artifact, so the `exports` map stops describing
 * the package's real surface and the aliases become the surface. Nothing caught
 * that: `check-consumer-boundaries.mjs` walks `apps/` only, so three alias tables
 * accumulated in `packages/` — `players-shared/components`,
 * `players-shared/ui/use-promise` and `players-shared/ui/use-zoom-compensation`.
 *
 * Aliased source imports are not banned; they are the only way to share Svelte
 * runes out of a package that builds with plain `tsc`. They have to be declared,
 * which is what ALIASED_SOURCE_SUBPATHS below is for: an exemption a reviewer can
 * see and argue with, rather than a silent gap.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { stripComments } from "./lib/strip-comments.mjs";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const SOURCE_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".svelte"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".turbo", ".svelte-kit"]);

/**
 * Where the source-resolved alias set is declared.
 *
 * Every Vite alias for one of these subpaths must name the same relative source
 * path this module gives, whether the config imports the module (item-player,
 * section-player) or spells the alias out (tool-tts-inline, whose `tsconfig`
 * puts `vite.config.ts` in its own TS program with `rootDir: "."`, so importing a
 * file from a sibling package raises TS6059). The check below is what keeps the
 * spelled-out ones honest.
 */
const ALIAS_DECLARATION = "packages/players-shared/svelte-source-aliases.ts";

/**
 * Subpaths that resolve from source through a Vite alias rather than from `dist`.
 *
 * Each is a Svelte rune module or component: `players-shared` builds with `tsc`,
 * whose config excludes `src/**\/*.svelte.ts` and `src/components/**` because
 * `tsc` cannot compile either, so these never reach `dist`. Adding them to the
 * `exports` map means publishing the source and making them public API — a
 * consumer-facing decision, deliberately not taken here.
 *
 * The alias map itself lives in
 * `packages/players-shared/svelte-source-aliases.ts`; this list must match it.
 */
const ALIASED_SOURCE_SUBPATHS = new Set([
	"@pie-players/pie-players-shared/components",
	"@pie-players/pie-players-shared/ui/use-promise",
	"@pie-players/pie-players-shared/ui/use-zoom-compensation",
]);

const IMPORT_REGEXES = [
	/\bfrom\s+["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
	/\bimport\s+["']([^"']+)["']/g,
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const rel = (p) => path.relative(ROOT, p).replaceAll("\\", "/");

function walk(dir, visit) {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) continue;
		const abs = path.join(dir, entry);
		if (statSync(abs).isDirectory()) {
			walk(abs, visit);
			continue;
		}
		if (SOURCE_EXTENSIONS.has(path.extname(abs))) visit(abs);
	}
}

/** name -> Set of declared subpath specifiers, for every workspace package. */
function collectDeclaredSubpaths() {
	const declared = new Map();
	for (const entry of readdirSync(PACKAGES_DIR)) {
		const manifestPath = path.join(PACKAGES_DIR, entry, "package.json");
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		if (!manifest.name) continue;
		const subpaths = new Set([manifest.name]);
		for (const key of Object.keys(manifest.exports ?? {})) {
			if (key === ".") continue;
			if (key.includes("*")) {
				subpaths.add(`${manifest.name}/${key.slice(2)}`);
				continue;
			}
			subpaths.add(`${manifest.name}/${key.slice(2)}`);
		}
		declared.set(manifest.name, subpaths);
	}
	return declared;
}

/**
 * Every `resolve.alias` entry for an aliased-source subpath, as
 * `{ config, subpath, target }`, from the Vite configs that spell one out.
 */
function collectViteAliases() {
	const found = [];
	for (const entry of readdirSync(PACKAGES_DIR)) {
		const configPath = path.join(PACKAGES_DIR, entry, "vite.config.ts");
		if (!existsSync(configPath)) continue;
		const source = stripComments(readFileSync(configPath, "utf8"));
		for (const subpath of ALIASED_SOURCE_SUBPATHS) {
			// `"<subpath>": resolve(__dirname, "<target>")`
			const pattern = new RegExp(
				`["']${subpath.replace(/[/\-]/g, "\\$&")}["']\\s*:\\s*resolve\\(\\s*__dirname\\s*,\\s*["']([^"']+)["']`,
			);
			const match = pattern.exec(source);
			if (match) {
				found.push({ config: rel(configPath), subpath, target: match[1] });
			}
		}
	}
	return found;
}

/** The relative source path the declaration module gives for each subpath. */
function collectDeclaredAliasTargets() {
	const declarationPath = path.join(ROOT, ALIAS_DECLARATION);
	const source = readFileSync(declarationPath, "utf8");
	const targets = new Map();
	const pattern =
		/["'](@pie-players\/pie-players-shared\/[^"']+)["']\s*:\s*\n?\s*["']([^"']+)["']/g;
	let match = pattern.exec(source);
	while (match !== null) {
		targets.set(match[1], match[2]);
		match = pattern.exec(source);
	}
	return targets;
}

function main() {
	const declared = collectDeclaredSubpaths();
	const failures = [];

	// Every aliased-source subpath must appear in the declaration module, and every
	// spelled-out Vite alias must agree with it. Otherwise the "one declaration"
	// is one declaration plus however many copies drifted.
	const declaredTargets = collectDeclaredAliasTargets();
	for (const subpath of ALIASED_SOURCE_SUBPATHS) {
		if (!declaredTargets.has(subpath)) {
			failures.push(
				`${ALIAS_DECLARATION}: does not declare "${subpath}", which this script exempts as an aliased source path`,
			);
		}
	}
	for (const { config, subpath, target } of collectViteAliases()) {
		const expected = declaredTargets.get(subpath);
		if (expected === undefined) continue;
		// Configs spell the target relative to their own directory.
		const normalized = target.replace(/^\.\.\/players-shared\//, "");
		if (normalized !== expected) {
			failures.push(
				`${config}: aliases "${subpath}" to "${target}", but ${ALIAS_DECLARATION} declares "${expected}"`,
			);
		}
	}

	walk(PACKAGES_DIR, (filePath) => {
		// Comments are not imports: a docblock's example specifier is documentation,
		// and `check-doc-package-imports` is what covers those.
		const source = stripComments(readFileSync(filePath, "utf8"));
		for (const regex of IMPORT_REGEXES) {
			regex.lastIndex = 0;
			let match = regex.exec(source);
			while (match !== null) {
				const specifier = match[1];
				match = regex.exec(source);
				if (!specifier.startsWith("@pie-players/")) continue;
				// Strip a Vite/Svelte query suffix before comparing.
				const bare = specifier.split("?")[0];
				const owner = bare.split("/").slice(0, 2).join("/");
				const ownerSubpaths = declared.get(owner);
				// Not a workspace package (or not one in packages/): out of scope.
				if (!ownerSubpaths) continue;
				if (ownerSubpaths.has(bare)) continue;
				if (ALIASED_SOURCE_SUBPATHS.has(bare)) continue;
				failures.push(
					`${rel(filePath)}: imports "${specifier}", which ${owner} does not declare in its exports map`,
				);
			}
		}
	});

	const unique = [...new Set(failures)].sort();
	if (unique.length > 0) {
		console.error(
			"[check-undeclared-subpaths] cross-package imports must name a declared subpath:\n",
		);
		for (const failure of unique) console.error(`  - ${failure}`);
		console.error(
			"\nAdd the subpath to the owning package's `exports` map, or import a subpath" +
				"\nthat is already declared. If it can only resolve from source through a" +
				"\nVite alias, add it to ALIASED_SOURCE_SUBPATHS in this script with the" +
				"\nreason, and to packages/players-shared/svelte-source-aliases.ts.",
		);
		process.exit(1);
	}

	console.log(
		`[check-undeclared-subpaths] OK: every cross-package subpath import is declared (${ALIASED_SOURCE_SUBPATHS.size} aliased-source exemption(s))`,
	);
}

if (import.meta.main) main();

export { ALIASED_SOURCE_SUBPATHS, collectDeclaredSubpaths };
