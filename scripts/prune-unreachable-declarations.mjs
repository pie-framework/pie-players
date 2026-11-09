#!/usr/bin/env node
/**
 * Removes the declaration files from a package's `dist` that no type entry
 * reaches, and fails a package that still ships one.
 *
 * TypeScript loads a declaration only when a type entry's closure imports it,
 * because `exports` blocks every other path. A file outside the closure ships
 * dead: pie-i18n-generated's per-locale declarations were 745 KB, and a
 * calculator-cortex source declaration importing a devDependency broke nothing
 * only because no entry reached it. `tsc` and `vite-plugin-dts` emit one
 * declaration per source file, so a package's `build` ends with this script.
 *
 *   bun ../../scripts/prune-unreachable-declarations.mjs   prune the package in the cwd
 *   bun scripts/prune-unreachable-declarations.mjs --check  fail every package that ships one
 *
 * The closure is `walkDeclarationClosure` from `check-svelte-type-imports.mjs`,
 * which that check walks too, so the two cannot disagree on what a host loads.
 */

import {
	existsSync,
	readdirSync,
	readFileSync,
	rmdirSync,
	rmSync,
	statSync,
} from "node:fs";
import path from "node:path";
import {
	collectShippedDeclarations,
	collectTypeEntries,
	getPublishableWorkspaceDirs,
	walkDeclarationClosure,
} from "./check-svelte-type-imports.mjs";

/**
 * The declaration files under `dist` that no type entry of the package at `dir`
 * reaches. Throws when an entry is missing or the package has none, so a build
 * that has not run cannot read as "everything is unreachable".
 */
export function findUnreachableDeclarations({ dir, pkg }) {
	const { entries, missing } = collectTypeEntries(dir, pkg);
	if (entries.length === 0 || missing.length > 0) {
		const reason =
			missing.length > 0
				? `type entr${missing.length === 1 ? "y" : "ies"} ${missing.join(", ")} missing`
				: "no type entry exists";
		throw new Error(`${pkg.name}: ${reason}; build the package first`);
	}
	const reached = walkDeclarationClosure(entries, () => {});
	const dist = path.join(dir, "dist") + path.sep;
	return collectShippedDeclarations(dir, pkg).filter(
		(file) => file.startsWith(dist) && !reached.has(file),
	);
}

/** Deletes `files` and the directories that empties; returns the bytes freed. */
export function removeDeclarations(files, stopAt) {
	let bytes = 0;
	for (const file of files) {
		bytes += statSync(file).size;
		rmSync(file);
	}
	const directories = new Set(files.map((file) => path.dirname(file)));
	for (const start of directories) {
		for (
			let directory = start;
			directory.startsWith(stopAt + path.sep) && readdirSync(directory).length === 0;
			directory = path.dirname(directory)
		) {
			rmdirSync(directory);
		}
	}
	return bytes;
}

const readPackage = (dir) =>
	JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));

function check() {
	const failures = [];
	let packages = 0;
	for (const dir of getPublishableWorkspaceDirs()) {
		const pkg = readPackage(dir);
		if (!existsSync(path.join(dir, "dist"))) continue;
		packages += 1;
		const unreachable = findUnreachableDeclarations({ dir, pkg });
		if (unreachable.length > 0) {
			failures.push(
				`${pkg.name}: ${unreachable.length} declaration file(s) no type entry reaches, such as ${path.relative(dir, unreachable[0])}`,
			);
		}
	}
	if (failures.length > 0) {
		console.error(
			`[prune-unreachable-declarations] ${failures.length} package(s) ship unreachable declarations`,
		);
		for (const failure of failures) console.error(`- ${failure}`);
		console.error(
			"\nEnd the package's build script with `bun ../../scripts/prune-unreachable-declarations.mjs`.",
		);
		process.exit(1);
	}
	console.log(
		`[prune-unreachable-declarations] OK: ${packages} package(s), every shipped declaration reachable from a type entry`,
	);
}

function prune() {
	const dir = process.cwd();
	const pkg = readPackage(dir);
	const unreachable = findUnreachableDeclarations({ dir, pkg });
	const bytes = removeDeclarations(unreachable, path.join(dir, "dist"));
	console.log(
		`[prune-unreachable-declarations] ${pkg.name}: removed ${unreachable.length} declaration file(s), ${Math.round(bytes / 1024)} KB`,
	);
}

if (import.meta.main) {
	if (process.argv.includes("--check")) check();
	else prune();
}
