#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * A host installs PIE packages and nothing else, so no published declaration may
 * import `svelte`. TypeScript loads every declaration a published entry reaches,
 * and a host without Svelte then fails with TS2307 under `skipLibCheck: false`,
 * or types the surface as `any` under `skipLibCheck: true`. Only a copy hoisted
 * from some other package's dependency hides the failure.
 *
 * `check-svelte-runtime-deps.mjs` governs the manifests and `check-publint.mjs`
 * the runtime import closure. This walks the declaration closure of every type
 * entry and reports the chain of files that reaches `svelte`. A shipped
 * declaration no entry reaches is reported too: it loads into no host, but it is
 * one re-export away from an entry.
 */

const ROOT = process.cwd();
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

export const isSvelteSpecifier = (specifier) =>
	specifier === "svelte" || specifier.startsWith("svelte/");

/**
 * Every module a declaration file refers to. Parsed rather than pattern-matched,
 * because declarations carry JSDoc, and a usage example that mentions
 * `from "svelte"` in a comment loads nothing.
 */
export function findModuleReferences(source, fileName = "index.d.ts") {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		false,
		ts.ScriptKind.TS,
	);
	const specifiers = [];
	const visit = (node) => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			specifiers.push(node.moduleSpecifier.text);
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			ts.isStringLiteral(node.moduleReference.expression)
		) {
			specifiers.push(node.moduleReference.expression.text);
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument) &&
			ts.isStringLiteral(node.argument.literal)
		) {
			specifiers.push(node.argument.literal.text);
		} else if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
			// `declare module "svelte"` augments the host's Svelte, so it needs one.
			specifiers.push(node.name.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return {
		specifiers,
		referencedPaths: sourceFile.referencedFiles.map(({ fileName }) => fileName),
		typeReferences: sourceFile.typeReferenceDirectives.map(
			({ fileName }) => fileName,
		),
	};
}

const DECLARATION_FOR_RUNTIME_EXTENSION = [
	[".js", ".d.ts"],
	[".mjs", ".d.mts"],
	[".cjs", ".d.cts"],
	[".ts", ".d.ts"],
	[".mts", ".d.mts"],
	[".cts", ".d.cts"],
];

/**
 * The declaration file TypeScript loads for a relative specifier: `./a.js` reads
 * `./a.d.ts`, and `./Panel.svelte` or `./Panel.svelte.js` reads
 * `./Panel.svelte.d.ts`, which is where vite-plugin-dts writes a component's
 * declarations.
 */
export function resolveDeclarationFile(fromFile, specifier) {
	const target = path.resolve(path.dirname(fromFile), specifier);
	if (DECLARATION_FILE.test(target)) return existsSync(target) ? target : null;
	const candidates = [];
	const runtime = DECLARATION_FOR_RUNTIME_EXTENSION.find(([extension]) =>
		target.endsWith(extension),
	);
	if (runtime) {
		candidates.push(target.slice(0, -runtime[0].length) + runtime[1]);
	} else {
		const extension = path.extname(target);
		candidates.push(`${target}.d.ts`, path.join(target, "index.d.ts"));
		if (extension) {
			candidates.push(`${target.slice(0, -extension.length)}.d${extension}.ts`);
		}
	}
	return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const collectTargets = (value, out) => {
	if (typeof value === "string") {
		out.add(value);
	} else if (value && typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

/**
 * The declaration files a host's TypeScript can start from: every `types`
 * condition and top-level `types`/`typings`, plus the sibling declarations of
 * runtime targets, which TypeScript reads for a condition without `types`.
 */
export function collectTypeEntries(dir, pkg) {
	const targets = new Set();
	collectTargets(pkg.exports, targets);
	for (const field of ["types", "typings"]) {
		if (typeof pkg[field] === "string") targets.add(pkg[field]);
	}
	const entries = new Set();
	const missing = [];
	for (const target of targets) {
		if (!target.startsWith("./") || target.includes("*")) continue;
		const absolute = path.join(dir, target);
		if (DECLARATION_FILE.test(target)) {
			if (existsSync(absolute)) entries.add(absolute);
			else missing.push(target);
			continue;
		}
		const declaration = resolveDeclarationFile(
			path.join(dir, "package.json"),
			target,
		);
		if (declaration) entries.add(declaration);
	}
	return { entries: [...entries].sort(), missing };
}

/** The declaration files npm packs: each `files` entry, walked when a directory. */
export function collectShippedDeclarations(dir, pkg) {
	const found = new Set();
	const walk = (target) => {
		if (!existsSync(target)) return;
		if (statSync(target).isDirectory()) {
			for (const entry of readdirSync(target)) {
				if (entry !== "node_modules") walk(path.join(target, entry));
			}
		} else if (DECLARATION_FILE.test(target)) {
			found.add(target);
		}
	};
	for (const entry of pkg.files ?? []) walk(path.join(dir, entry));
	return [...found].sort();
}

const svelteReferencesOf = (file) => {
	const { specifiers, typeReferences } = findModuleReferences(
		readFileSync(file, "utf8"),
		file,
	);
	return [...specifiers, ...typeReferences].filter(isSvelteSpecifier);
};

/**
 * One finding per reference to `svelte` in a package's published declarations,
 * with the chain of files from a type entry to the file that makes it. Imports of
 * other packages are not followed: each publishable package is checked on its
 * own.
 */
export function findSvelteTypeImports({ dir, pkg }) {
	const { entries, missing } = collectTypeEntries(dir, pkg);
	const relative = (file) => path.relative(dir, file).split(path.sep).join("/");
	const findings = missing.map((target) => ({
		chain: [target.replace(/^\.\//, "")],
		reason: "is a type entry that does not exist; build first",
	}));
	const parents = new Map(entries.map((entry) => [entry, null]));
	const chainTo = (file) => {
		const chain = [];
		for (let current = file; current; current = parents.get(current)) {
			chain.unshift(relative(current));
		}
		return chain;
	};
	const queue = [...entries];
	const enqueue = (file, parent) => {
		if (!file || parents.has(file)) return;
		parents.set(file, parent);
		queue.push(file);
	};
	while (queue.length > 0) {
		const file = queue.shift();
		const { specifiers, referencedPaths, typeReferences } =
			findModuleReferences(readFileSync(file, "utf8"), file);
		for (const specifier of [...specifiers, ...typeReferences]) {
			if (specifier.startsWith(".") || specifier.startsWith("/")) {
				enqueue(resolveDeclarationFile(file, specifier), file);
			} else if (isSvelteSpecifier(specifier)) {
				findings.push({
					chain: chainTo(file),
					reason: `imports "${specifier}"`,
				});
			}
		}
		for (const referencedPath of referencedPaths) {
			const target = path.resolve(path.dirname(file), referencedPath);
			enqueue(existsSync(target) ? target : null, file);
		}
	}
	for (const file of collectShippedDeclarations(dir, pkg)) {
		if (parents.has(file)) continue;
		for (const specifier of svelteReferencesOf(file)) {
			findings.push({
				chain: [relative(file)],
				reason: `imports "${specifier}" and ships, though no type entry reaches it`,
			});
		}
	}
	return { findings, entriesChecked: entries.length };
}

const getPublishableWorkspaceDirs = () => {
	const rootPkg = readJson(path.join(ROOT, "package.json"));
	const dirs = [];
	for (const workspace of rootPkg.workspaces ?? []) {
		if (typeof workspace !== "string") continue;
		const parent = path.join(ROOT, workspace.slice(0, -2));
		const candidates = !workspace.endsWith("/*")
			? [path.join(ROOT, workspace)]
			: existsSync(parent)
				? readdirSync(parent, { withFileTypes: true })
						.filter((entry) => entry.isDirectory())
						.map((entry) => path.join(parent, entry.name))
				: [];
		for (const dir of candidates) {
			const manifestPath = path.join(dir, "package.json");
			if (existsSync(manifestPath) && readJson(manifestPath).private !== true) {
				dirs.push(dir);
			}
		}
	}
	return dirs.sort();
};

function main() {
	const violations = [];
	let packages = 0;
	let entries = 0;
	for (const dir of getPublishableWorkspaceDirs()) {
		const pkg = readJson(path.join(dir, "package.json"));
		const { findings, entriesChecked } = findSvelteTypeImports({ dir, pkg });
		packages += 1;
		entries += entriesChecked;
		for (const { chain, reason } of findings) {
			violations.push(`${pkg.name}: ${chain.join(" -> ")} ${reason}`);
		}
	}

	if (violations.length > 0) {
		console.error(
			`[check-svelte-type-imports] Found ${violations.length} published declaration(s) importing svelte. Hosts install no Svelte: type the surface without it, or stop emitting declarations for Svelte components.`,
		);
		for (const violation of violations) console.error(`- ${violation}`);
		process.exit(1);
	}

	console.log(
		`[check-svelte-type-imports] OK: the declarations of ${packages} publishable package(s), reached from ${entries} type entries or shipped, import no svelte`,
	);
}

if (import.meta.main) main();
