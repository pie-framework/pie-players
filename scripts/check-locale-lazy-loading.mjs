#!/usr/bin/env node

/**
 * `check-locale-lazy-loading`.
 *
 * Localized content other than English loads through a dynamic `import()`, one
 * chunk per locale, so a bundle opened in English never carries another
 * language. English is the fallback and stays statically resident. The check
 * fails on a static `import` or `export ... from` of a module whose file name is
 * a language tag other than English: `./messages/nl-NL.js`,
 * `./element-names/ar.json`, `speech-rule-engine/lib/mathmaps/es.json`.
 * `import type` is erased at compile time and passes.
 *
 * It scans the source of every package under `packages/`, tests and build
 * scripts excluded. A tag is recognized by its file name alone, so content kept
 * under another name, or inline in a module, is the reviewer's to catch.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const DEFAULT_ROOT = process.cwd();
const SKIPPED_DIRS = new Set([
	"node_modules",
	"dist",
	".svelte-kit",
	".turbo",
	"coverage",
	"test",
	"tests",
	"__tests__",
	"e2e",
	"scripts",
	"calibration",
]);
const SOURCE_EXTENSIONS = [".ts", ".js", ".mjs", ".svelte"];
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });
// Language, then an optional script and region: `ar`, `nl-NL`, `zh-Hant`, `es-419`.
const LANGUAGE_TAG = /^([a-z]{2,3})(?:[-_][A-Za-z]{4})?(?:[-_](?:[A-Za-z]{2}|\d{3}))?$/;

/**
 * The non-English language a module specifier names by its file name, or null.
 * A bare package name (`node:fs`, `svelte`) names no file and never matches.
 */
export function localeOfSpecifier(specifier) {
	if (!specifier.includes("/")) return null;
	const fileName = specifier.split(/[?#]/)[0].split("/").pop() ?? "";
	const stem = fileName.replace(/(?:\.[a-z]+)+$/, "");
	const match = LANGUAGE_TAG.exec(stem);
	if (!match) return null;
	const language = match[1];
	if (language === "en") return null;
	return LANGUAGE_NAMES.of(language) === language ? null : stem;
}

function listSourceFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			if (!SKIPPED_DIRS.has(entry)) out.push(...listSourceFiles(full));
			continue;
		}
		if (
			stat.isFile() &&
			SOURCE_EXTENSIONS.some((extension) => entry.endsWith(extension)) &&
			!/\.(?:test|spec)\.[a-z]+$/.test(entry) &&
			!entry.endsWith(".d.ts")
		) {
			out.push(full);
		}
	}
	return out;
}

/** The script blocks of a `.svelte` file, or the whole file otherwise. */
function scriptSources(file, text) {
	if (!file.endsWith(".svelte")) return [text];
	return [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
		(match) => match[1],
	);
}

function staticSpecifiers(file, text) {
	const specifiers = [];
	for (const source of scriptSources(file, text)) {
		const sourceFile = ts.createSourceFile(
			file,
			source,
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TS,
		);
		for (const statement of sourceFile.statements) {
			const isStatic =
				(ts.isImportDeclaration(statement) &&
					!statement.importClause?.isTypeOnly) ||
				(ts.isExportDeclaration(statement) && !statement.isTypeOnly);
			if (
				isStatic &&
				statement.moduleSpecifier &&
				ts.isStringLiteralLike(statement.moduleSpecifier)
			) {
				specifiers.push(statement.moduleSpecifier.text);
			}
		}
	}
	return specifiers;
}

export function checkLocaleLazyLoading(root = DEFAULT_ROOT) {
	const packagesDir = path.join(root, "packages");
	const files = readdirSync(packagesDir)
		.map((entry) => path.join(packagesDir, entry))
		.filter((dir) => statSync(dir).isDirectory())
		.flatMap(listSourceFiles);
	const violations = [];
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		for (const specifier of staticSpecifiers(file, text)) {
			const locale = localeOfSpecifier(specifier);
			if (locale) {
				violations.push({
					file: path.relative(root, file).replaceAll("\\", "/"),
					specifier,
					locale,
				});
			}
		}
	}
	return { files: files.length, violations };
}

if (import.meta.main) {
	const { files, violations } = checkLocaleLazyLoading();
	if (violations.length > 0) {
		console.error(
			"[check-locale-lazy-loading] static import(s) of non-English localized content:",
		);
		for (const v of violations) {
			console.error(`  ${v.file}: "${v.specifier}" (${v.locale})`);
		}
		console.error(
			"\nLoad each locale through a static map of `import()` loaders, as " +
				"packages/players-shared/src/i18n/catalogs.ts does, so it stays its own chunk.",
		);
		process.exit(1);
	}
	console.log(
		`[check-locale-lazy-loading] OK: no static import of non-English localized content in ${files} source file(s)`,
	);
}
