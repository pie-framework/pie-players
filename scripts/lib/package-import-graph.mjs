/**
 * The import graph of a publishable package: which files a consumer can reach
 * from the manifest, and which packages those files name.
 *
 * Scripts and chunks go through `Bun.Transpiler.scanImports`, which parses the
 * file and ignores specifiers inside comments, strings and template literals.
 * Declaration files go through the TypeScript parser, since the transpiler
 * drops every type-only import. Stylesheets are scanned for `@import`.
 *
 * A package has two runtime builds. The npm build under `dist/` leaves its
 * dependencies as bare imports for the consumer's bundler. The browser build
 * under `dist/browser/` loads by URL with no import map, so it bundles every
 * dependency and may name nothing bare.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";

const SCRIPT_FILE = /\.[cm]?js$/;
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
const STYLESHEET_FILE = /\.css$/;
const BROWSER_BUILD_PREFIX = "./dist/browser/";
const CSS_IMPORT_PATTERN = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;
const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const IGNORED_PROTOCOLS = ["node:", "bun:", "virtual:", "data:", "blob:"];
const IGNORED_PREFIXES = ["vite/"];
const BUILTIN_MODULES = new Set(
	builtinModules.map((name) => name.replace(/^node:/, "")),
);

const scriptScanner = new Bun.Transpiler({ loader: "js" });

const SCRIPT_IMPORT_KINDS = {
	"import-statement": "static",
	"dynamic-import": "dynamic",
	"require-call": "require",
	"require-resolve": "require",
};

/**
 * The module specifiers a script imports, requires or loads with `import()`.
 * A specifier holding `${` is a template literal the code builds, so it names
 * no module.
 */
export function scanScriptImports(code) {
	return scriptScanner
		.scanImports(code)
		.filter((entry) => entry.kind in SCRIPT_IMPORT_KINDS)
		.filter((entry) => !entry.path.includes("${"))
		.map((entry) => ({
			specifier: entry.path,
			kind: SCRIPT_IMPORT_KINDS[entry.kind],
		}));
}

/**
 * The module specifiers a declaration file names: `import` and `export ... from`
 * (type-only ones included), `import x = require()`, `import("x")` types and
 * `/// <reference>` directives. `reference-types` names a package under the
 * `types` of a `/// <reference types>`.
 */
export function scanDeclarationImports(code, fileName = "index.d.ts") {
	const source = ts.createSourceFile(
		fileName,
		code,
		ts.ScriptTarget.Latest,
		false,
		ts.ScriptKind.TS,
	);
	const found = [];
	const visit = (node) => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			found.push({ specifier: node.moduleSpecifier.text, kind: "type" });
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			ts.isStringLiteral(node.moduleReference.expression)
		) {
			found.push({
				specifier: node.moduleReference.expression.text,
				kind: "type",
			});
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument) &&
			ts.isStringLiteral(node.argument.literal)
		) {
			found.push({ specifier: node.argument.literal.text, kind: "type" });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	for (const directive of source.typeReferenceDirectives) {
		found.push({ specifier: directive.fileName, kind: "reference-types" });
	}
	for (const reference of source.referencedFiles) {
		found.push({ specifier: reference.fileName, kind: "reference-path" });
	}
	return found;
}

/** The module specifiers a stylesheet pulls in with `@import`. */
export function scanStylesheetImports(code) {
	const withoutComments = code.replace(CSS_COMMENT_PATTERN, "");
	return [...withoutComments.matchAll(CSS_IMPORT_PATTERN)].map((match) => ({
		specifier: match[1],
		kind: "stylesheet",
	}));
}

/** The npm package a bare specifier names: `@scope/name/deep` is `@scope/name`. */
export const toPackageName = (specifier) => {
	if (specifier.startsWith("@")) {
		const [scope, name] = specifier.split("/");
		return scope && name ? `${scope}/${name}` : specifier;
	}
	return specifier.split("/")[0];
};

/**
 * The specifier names something other than a package a consumer installs: a
 * relative or absolute path, a Node builtin or a build-time protocol.
 */
const namesNoPackage = (specifier) =>
	specifier.startsWith(".") ||
	specifier.startsWith("/") ||
	BUILTIN_MODULES.has(specifier) ||
	BUILTIN_MODULES.has(specifier.split("/")[0]) ||
	IGNORED_PROTOCOLS.some((protocol) => specifier.startsWith(protocol)) ||
	IGNORED_PREFIXES.some((prefix) => specifier.startsWith(prefix));

const isRelative = (specifier) => specifier.startsWith(".");

const isFile = (candidate) =>
	existsSync(candidate) && statSync(candidate).isFile();

const resolveRelative = (fromFile, specifier) => {
	const base = path.resolve(path.dirname(fromFile), specifier);
	const withDeclarationSuffix = (suffix) =>
		/\.[cm]?js$/.test(base) ? base.replace(/\.[cm]?js$/, suffix) : null;
	// A declaration's `./x.js` names `./x.d.ts`, so the script beside it must not win.
	const candidates = DECLARATION_FILE.test(fromFile)
		? [
				withDeclarationSuffix(".d.ts"),
				withDeclarationSuffix(".d.mts"),
				`${base}.d.ts`,
				path.join(base, "index.d.ts"),
				...(DECLARATION_FILE.test(base) ? [base] : []),
			]
		: [base, `${base}.js`, path.join(base, "index.js")];
	return candidates.find((candidate) => candidate && isFile(candidate)) ?? null;
};

const scanFile = (file, code) => {
	if (DECLARATION_FILE.test(file)) return scanDeclarationImports(code, file);
	if (SCRIPT_FILE.test(file)) return scanScriptImports(code);
	if (STYLESHEET_FILE.test(file)) return scanStylesheetImports(code);
	return [];
};

/**
 * Every file reachable from `roots` through relative imports, and the specifiers
 * those files name that point outside the package.
 *
 * `references` holds one entry per bare specifier per file. `dangling` holds the
 * relative specifiers that resolve to no file on disk.
 */
export function walkImportClosure(roots) {
	const visited = new Set();
	const queue = [...roots];
	const references = [];
	const dangling = [];
	while (queue.length > 0) {
		const file = queue.shift();
		if (visited.has(file)) continue;
		visited.add(file);
		let scanned;
		try {
			scanned = scanFile(file, readFileSync(file, "utf8"));
		} catch (error) {
			throw new Error(`cannot scan ${file}: ${error.message}`);
		}
		for (const { specifier, kind } of scanned) {
			if (kind === "reference-types") {
				references.push({ file, specifier, kind });
				continue;
			}
			if (isRelative(specifier)) {
				const resolved = resolveRelative(file, specifier);
				if (resolved) queue.push(resolved);
				else dangling.push({ file, specifier });
				continue;
			}
			if (namesNoPackage(specifier)) continue;
			references.push({ file, specifier, kind });
		}
	}
	return { files: visited, references, dangling };
}

const collectStrings = (value, out) => {
	if (typeof value === "string") out.add(value);
	else if (Array.isArray(value)) for (const entry of value) collectStrings(entry, out);
	else if (value && typeof value === "object")
		for (const entry of Object.values(value)) collectStrings(entry, out);
};

/**
 * The files a consumer enters the package through, split by build. Targets with
 * a wildcard or outside the package are skipped; a target missing on disk is
 * left to publint and the pack checks.
 */
export function collectRoots(dir, pkg) {
	const targets = new Set();
	for (const field of [
		"main",
		"module",
		"types",
		"typings",
		"unpkg",
		"jsdelivr",
		"exports",
	]) {
		collectStrings(pkg[field], targets);
	}
	const roots = { npm: [], browser: [] };
	for (const target of [...targets].sort()) {
		if (!target.startsWith("./") || target.includes("*")) continue;
		const file = path.join(dir, target);
		if (!isFile(file)) continue;
		const isBrowser =
			SCRIPT_FILE.test(target) && target.startsWith(BROWSER_BUILD_PREFIX);
		roots[isBrowser ? "browser" : "npm"].push(file);
	}
	return roots;
}

/** `@types/foo` and `@types/scope__name`, the declaration package for `foo`. */
const declarationPackageFor = (name) =>
	`@types/${name.startsWith("@") ? name.slice(1).replace("/", "__") : name}`;

const declaredPackages = (pkg) =>
	new Set([
		...Object.keys(pkg.dependencies || {}),
		...Object.keys(pkg.peerDependencies || {}),
		...Object.keys(pkg.optionalDependencies || {}),
	]);

/** A declaration may be satisfied by the package or by its `@types` package. */
const isDeclaredForTypes = (declared, name) =>
	declared.has(name) || declared.has(declarationPackageFor(name));

const relativeTo = (root, file) => path.relative(root, file) || file;

/**
 * What is wrong with the way `pkg` declares and imports its packages. Each
 * finding has a `code` and a `message`:
 *
 * - `phantom-import`: the npm build imports a package it does not declare.
 * - `phantom-type-import`: a published declaration names a package it does not
 *   declare.
 * - `browser-bare-import`: the browser build imports something bare, though it
 *   must bundle everything.
 * - `type-only-dependency`: a `dependencies` entry that only declarations name.
 *   A package whose own declarations expose the type may list it in
 *   `allowedTypeOnlyDependencies`.
 * - `unreachable-dependency`: a `dependencies` entry that no file reachable from
 *   the manifest names, such as one the build inlines.
 * - `dangling-import`: a shipped file imports a relative file that is not there.
 * - `stale-allowance`: an `undeclaredNpm`, `typeOnly` or `unreachable` entry
 *   that excuses nothing, so the policy drops it when the cause is fixed.
 *
 * `allowed` holds the policy's `undeclaredNpm` and `undeclaredBrowser`
 * specifiers and the `typeOnly` and `unreachable` dependencies for this package.
 * Nothing here can tell which `undeclaredBrowser` entry a build needs: the
 * bundle-safety check reads the same list and sees text a scanner skips.
 */
export function analyzePackage({
	dir,
	pkg,
	root = process.cwd(),
	allowed = {},
}) {
	const { npm, browser } = collectRoots(dir, pkg);
	const findings = [];
	const declared = declaredPackages(pkg);
	const undeclaredNpm = new Set(allowed.undeclaredNpm ?? []);
	const undeclaredBrowser = new Set(allowed.undeclaredBrowser ?? []);
	const typeOnly = new Set(allowed.typeOnly ?? []);
	const unreachable = new Set(allowed.unreachable ?? []);
	const usedNpm = new Set();
	const usedTypeOnly = new Set();
	const usedUnreachable = new Set();
	const where = (file) => relativeTo(root, file);

	const npmClosure = walkImportClosure(npm);
	const browserClosure = walkImportClosure(browser);

	const runtimeNames = new Set();
	const typeNames = new Set();
	for (const reference of npmClosure.references) {
		const name = toPackageName(reference.specifier);
		if (!DECLARATION_FILE.test(reference.file)) {
			runtimeNames.add(name);
			if (name === pkg.name || declared.has(name)) continue;
			const excused = [reference.specifier, name].find((key) =>
				undeclaredNpm.has(key),
			);
			if (excused !== undefined) {
				usedNpm.add(excused);
				continue;
			}
			findings.push({
				code: "phantom-import",
				message: `${where(reference.file)} imports "${reference.specifier}", but "${name}" is not in dependencies, peerDependencies or optionalDependencies`,
			});
			continue;
		}
		typeNames.add(name);
		typeNames.add(declarationPackageFor(name));
		if (name === pkg.name || isDeclaredForTypes(declared, name)) continue;
		findings.push({
			code: "phantom-type-import",
			message: `${where(reference.file)} names "${reference.specifier}" in its types, but "${name}" is not in dependencies, peerDependencies or optionalDependencies`,
		});
	}

	for (const reference of browserClosure.references) {
		if (undeclaredBrowser.has(reference.specifier)) continue;
		findings.push({
			code: "browser-bare-import",
			message: `${where(reference.file)} imports "${reference.specifier}"; the browser build bundles every dependency and loads with no import map`,
		});
	}

	for (const name of Object.keys(pkg.dependencies || {})) {
		if (runtimeNames.has(name)) continue;
		if (name.startsWith("@types/") && typeNames.has(name)) continue;
		if (typeNames.has(name)) {
			if (typeOnly.has(name)) {
				usedTypeOnly.add(name);
				continue;
			}
			findings.push({
				code: "type-only-dependency",
				message: `"${name}" is a dependency that only the published declarations name; no script a consumer runs imports it`,
			});
			continue;
		}
		if (unreachable.has(name)) {
			usedUnreachable.add(name);
			continue;
		}
		findings.push({
			code: "unreachable-dependency",
			message: `"${name}" is a dependency that no file reachable from the manifest imports`,
		});
	}

	for (const [list, used, key] of [
		[undeclaredNpm, usedNpm, "allowedUndeclaredRuntimeImports.npm"],
		[typeOnly, usedTypeOnly, "allowedTypeOnlyDependencies"],
		[unreachable, usedUnreachable, "allowedUnreachableDependencies"],
	]) {
		for (const entry of list) {
			if (used.has(entry)) continue;
			findings.push({
				code: "stale-allowance",
				message: `"${entry}" in ${key} excuses nothing; remove it from scripts/publish-policy.json`,
			});
		}
	}

	for (const { file, specifier } of [
		...npmClosure.dangling,
		...browserClosure.dangling,
	]) {
		findings.push({
			code: "dangling-import",
			message: `${where(file)} imports "${specifier}", which is not in the package`,
		});
	}
	return findings;
}

/** The files under `entry`, or `entry` itself when it is a file. */
export const listFiles = (entry) => {
	if (!existsSync(entry)) return [];
	if (!statSync(entry).isDirectory()) return [entry];
	return readdirSync(entry, { withFileTypes: true }).flatMap((child) =>
		listFiles(path.join(entry, child.name)),
	);
};
