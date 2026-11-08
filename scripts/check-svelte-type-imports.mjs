#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";

/**
 * A host installs the packages a manifest declares and nothing else, so a
 * published declaration may import only what the package depends on. Two ways
 * to break that, both with the same consumer symptom — TypeScript loads every
 * declaration a published entry reaches, and a host without the import fails
 * with TS2307 under `skipLibCheck: false`, or types the surface as `any` under
 * `skipLibCheck: true`. Only a copy hoisted from some other package's
 * dependency hides the failure:
 *
 * - importing `svelte`. Hosts install no Svelte: the players bundle their UI
 *   runtime, and no package declares it. `check-svelte-runtime-deps.mjs`
 *   governs the manifests and `check-publint.mjs` the runtime import closure.
 * - importing a package outside `dependencies` (a devDependency bundled away,
 *   typically). The runtime works because the build inlined it; the types do
 *   not resolve on a machine that installs the package alone.
 *
 * This walks the declaration closure of every type entry and reports the chain
 * of files that reaches a forbidden specifier. A shipped declaration no entry
 * reaches is reported too: it loads into no host, but it is one re-export away
 * from an entry.
 */

const ROOT = process.cwd();
const DECLARATION_FILE = /\.d\.[cm]?ts$/;

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

export const isSvelteSpecifier = (specifier) =>
	specifier === "svelte" || specifier.startsWith("svelte/");

/**
 * Node builtins load everywhere Node 20 does, in browsers through bundlers, and
 * declarations referencing them resolve from the compiler's own lib set.
 */
export const isNodeBuiltinSpecifier = (specifier) => {
	if (specifier.startsWith("node:")) return true;
	const [name] = specifier.split("/");
	if (name.startsWith("@")) return false; // scoped packages are never builtins
	return builtinModules.includes(name);
};

/**
 * The bare specifiers a package's published declarations may import: the
 * packages an install of it brings. `devDependencies` install for development
 * of the package, not for its consumer, so an import of one is a finding.
 */
export const declaredRuntimeDependencies = (pkg) => {
	const declared = new Set();
	for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
		for (const name of Object.keys(pkg[field] ?? {})) declared.add(name);
	}
	return declared;
};

/** `@scope/pkg/subpath` names `@scope/pkg`; `pkg/subpath` names `pkg`. */
export const packageNameOf = (specifier) => {
	const parts = specifier.split("/");
	return specifier.startsWith("@")
		? parts.slice(0, 2).join("/")
		: parts[0];
};

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

/**
 * Visits every declaration file a host's TypeScript loads from `entries`: the
 * relative imports, re-exports and `/// <reference path>` of each file, and
 * theirs in turn. `onFile(file, references, chainTo)` receives the parsed
 * references of each file and `chainTo(file)`, the entry-to-file path as
 * `relativeTo` names its files. Returns a map of each reached file to the file
 * that first reached it, which is `null` for an entry.
 */
export function walkDeclarationClosure(entries, onFile, relativeTo = (file) => file) {
	const parents = new Map(entries.map((entry) => [entry, null]));
	const chainTo = (file) => {
		const chain = [];
		for (let current = file; current; current = parents.get(current)) {
			chain.unshift(relativeTo(current));
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
		const references = findModuleReferences(readFileSync(file, "utf8"), file);
		onFile(file, references, chainTo);
		for (const specifier of [...references.specifiers, ...references.typeReferences]) {
			if (specifier.startsWith(".") || specifier.startsWith("/")) {
				enqueue(resolveDeclarationFile(file, specifier), file);
			}
		}
		for (const referencedPath of references.referencedPaths) {
			const target = path.resolve(path.dirname(file), referencedPath);
			enqueue(existsSync(target) ? target : null, file);
		}
	}
	return parents;
}

/**
 * One finding per forbidden bare specifier in a package's published
 * declarations, with the chain of files from a type entry to the file that
 * makes it: `svelte`, which no host installs, and any bare specifier outside
 * the package's declared runtime dependencies, which a consumer's install
 * cannot resolve. Imports of other packages are not followed: each publishable
 * package is checked on its own.
 */
export function findSvelteTypeImports({ dir, pkg }) {
	const { entries, missing } = collectTypeEntries(dir, pkg);
	const declared = declaredRuntimeDependencies(pkg);
	const undeclaredReason = (specifier) =>
		isNodeBuiltinSpecifier(specifier)
			? null
			: declared.has(packageNameOf(specifier))
				? null
				: isSvelteSpecifier(specifier)
					? `imports "${specifier}"; hosts install no Svelte`
					: `imports "${specifier}", which it does not declare as a dependency`;
	const relative = (file) => path.relative(dir, file).split(path.sep).join("/");
	const findings = missing.map((target) => ({
		chain: [target.replace(/^\.\//, "")],
		reason: "is a type entry that does not exist; build first",
	}));
	const parents = walkDeclarationClosure(entries, (file, references, chainTo) => {
		const { specifiers, typeReferences } = references;
		for (const specifier of [...specifiers, ...typeReferences]) {
			if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
			if (isSvelteSpecifier(specifier)) {
				findings.push({ chain: chainTo(file), reason: `imports "${specifier}"` });
				continue;
			}
			const reason = undeclaredReason(specifier);
			if (reason) {
				findings.push({ chain: chainTo(file), reason });
			}
		}
	}, relative);
	for (const file of collectShippedDeclarations(dir, pkg)) {
		if (parents.has(file)) continue;
		const { specifiers, typeReferences } = findModuleReferences(
			readFileSync(file, "utf8"),
			file,
		);
		for (const specifier of [...specifiers, ...typeReferences]) {
			// The sweep does not walk the closure of an unreachable file, so only
			// the absolute rule applies to it: no svelte. An undeclared dependency
			// in an unreachable declaration is latent, not a consumer break — the
			// walk above catches it the day an entry reaches the file.
			if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
			if (!isSvelteSpecifier(specifier)) continue;
			findings.push({
				chain: [relative(file)],
				reason: `imports "${specifier}" and ships, though no type entry reaches it`,
			});
		}
	}
	return { findings, entriesChecked: entries.length };
}

export const getPublishableWorkspaceDirs = () => {
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
			`[check-svelte-type-imports] Found ${violations.length} published declaration(s) importing svelte or an undeclared dependency. A host installs the declared dependencies and nothing else: declare the import, or type the surface without it.`,
		);
		for (const violation of violations) console.error(`- ${violation}`);
		process.exit(1);
	}

	console.log(
		`[check-svelte-type-imports] OK: the declarations of ${packages} publishable package(s), reached from ${entries} type entries or shipped, import no svelte and only declared dependencies`,
	);
}

if (import.meta.main) main();
