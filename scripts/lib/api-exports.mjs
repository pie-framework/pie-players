/**
 * The names a module exports, read from source syntax alone.
 *
 * A name is a type when the syntax says so: an `interface` or `type` declaration,
 * `export type`, or an `export { type X }` specifier. Every repository tsconfig
 * sets `verbatimModuleSyntax`, which rejects re-exporting a type without one of
 * those markers, so an unmarked re-export is a value. `export *` is followed into
 * the module it names: relative paths on disk, `@pie-players/*` specifiers through
 * the workspace source map. A star export of any other package cannot be read
 * from this repository and is reported as `* from "<specifier>"`.
 *
 * The parser is the TypeScript scanner with no program and no type checker, so
 * the result does not depend on a build and costs milliseconds per entry.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const RELATIVE_CANDIDATES = (stem) => [
	`${stem}.ts`,
	`${stem}.tsx`,
	`${stem}.d.ts`,
	`${stem}.js`,
	`${stem}.mjs`,
	path.join(stem, "index.ts"),
	path.join(stem, "index.js"),
];

/** The file a relative specifier names, or `undefined`. */
export function resolveRelative(fromFile, specifier) {
	const target = path.resolve(path.dirname(fromFile), specifier);
	if (/\.(?:svelte|json)$/.test(target)) {
		return existsSync(target) ? target : undefined;
	}
	const stem = target.replace(/\.(?:[cm]?js|ts)$/, "");
	return RELATIVE_CANDIDATES(stem).find((candidate) => existsSync(candidate));
}

/** The module script of a `.svelte` file, which is where its named exports live. */
function svelteModuleScript(source) {
	const match = source.match(
		/<script\b[^>]*\b(?:module|context=["']module["'])[^>]*>([\s\S]*?)<\/script>/,
	);
	return match ? match[1] : "";
}

function hasModifier(node, kind) {
	return ts.canHaveModifiers(node)
		? (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind)
		: false;
}

function bindingNames(name, out) {
	if (ts.isIdentifier(name)) {
		out.push(name.text);
		return;
	}
	for (const element of name.elements) {
		if (ts.isBindingElement(element)) bindingNames(element.name, out);
	}
}

/** Local name -> "type" | "value", for the declarations and imports of a file. */
function localKinds(sourceFile) {
	const kinds = new Map();
	for (const statement of sourceFile.statements) {
		if (ts.isImportDeclaration(statement) && statement.importClause) {
			const clause = statement.importClause;
			const clauseIsType = clause.isTypeOnly;
			if (clause.name) {
				kinds.set(clause.name.text, clauseIsType ? "type" : "value");
			}
			const bindings = clause.namedBindings;
			if (bindings && ts.isNamespaceImport(bindings)) {
				kinds.set(bindings.name.text, clauseIsType ? "type" : "value");
			} else if (bindings) {
				for (const element of bindings.elements) {
					kinds.set(
						element.name.text,
						clauseIsType || element.isTypeOnly ? "type" : "value",
					);
				}
			}
			continue;
		}
		if (
			ts.isInterfaceDeclaration(statement) ||
			ts.isTypeAliasDeclaration(statement)
		) {
			if (!kinds.has(statement.name.text)) {
				kinds.set(statement.name.text, "type");
			}
			continue;
		}
		if (
			(ts.isFunctionDeclaration(statement) ||
				ts.isClassDeclaration(statement) ||
				ts.isEnumDeclaration(statement) ||
				ts.isModuleDeclaration(statement)) &&
			statement.name &&
			ts.isIdentifier(statement.name)
		) {
			kinds.set(statement.name.text, "value");
			continue;
		}
		if (ts.isVariableStatement(statement)) {
			const names = [];
			for (const declaration of statement.declarationList.declarations) {
				bindingNames(declaration.name, names);
			}
			for (const name of names) kinds.set(name, "value");
		}
	}
	return kinds;
}

/**
 * The exported names of `file`, as a map of name -> "type" | "value".
 *
 * `resolvePackage(specifier)` returns the source file of a workspace package
 * specifier, or `undefined` for a package outside the workspace.
 */
export function moduleExports(file, { resolvePackage = () => undefined } = {}) {
	const visiting = new Set();

	const read = (current) => {
		const names = new Map();
		const unresolved = new Set();
		if (visiting.has(current)) return { names, unresolved };
		visiting.add(current);

		const add = (name, kind) => {
			// A name exported as both a type and a value (a class, or a const and a
			// type alias sharing a name) is a value to the importer.
			if (names.get(name) === "value") return;
			names.set(name, kind);
		};

		if (current.endsWith(".json")) {
			add("default", "value");
			return { names, unresolved };
		}

		let text = readFileSync(current, "utf8");
		if (current.endsWith(".svelte")) {
			add("default", "value");
			text = svelteModuleScript(text);
		}
		const scriptKind = /\.[cm]?js$/.test(current)
			? ts.ScriptKind.JS
			: ts.ScriptKind.TS;
		const sourceFile = ts.createSourceFile(
			current,
			text,
			ts.ScriptTarget.Latest,
			false,
			scriptKind,
		);
		const locals = localKinds(sourceFile);

		const follow = (specifier) => {
			if (specifier.startsWith(".")) return resolveRelative(current, specifier);
			return resolvePackage(specifier);
		};

		for (const statement of sourceFile.statements) {
			if (ts.isExportDeclaration(statement)) {
				const specifier =
					statement.moduleSpecifier &&
					ts.isStringLiteral(statement.moduleSpecifier)
						? statement.moduleSpecifier.text
						: undefined;
				const clause = statement.exportClause;
				if (!clause) {
					const target = specifier ? follow(specifier) : undefined;
					if (!target) {
						unresolved.add(specifier);
						continue;
					}
					const inner = read(target);
					for (const [name, kind] of inner.names) {
						if (name === "default") continue;
						add(name, statement.isTypeOnly ? "type" : kind);
					}
					for (const entry of inner.unresolved) unresolved.add(entry);
					continue;
				}
				if (ts.isNamespaceExport(clause)) {
					add(clause.name.text, statement.isTypeOnly ? "type" : "value");
					continue;
				}
				for (const element of clause.elements) {
					const exported = element.name.text;
					const isType = statement.isTypeOnly || element.isTypeOnly;
					if (isType) {
						add(exported, "type");
					} else if (specifier) {
						add(exported, "value");
					} else {
						const local = (element.propertyName ?? element.name).text;
						add(exported, locals.get(local) ?? "value");
					}
				}
				continue;
			}
			if (ts.isExportAssignment(statement)) {
				add("default", "value");
				continue;
			}
			if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
			if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
				add(
					"default",
					ts.isInterfaceDeclaration(statement) ? "type" : "value",
				);
				continue;
			}
			if (
				ts.isInterfaceDeclaration(statement) ||
				ts.isTypeAliasDeclaration(statement)
			) {
				add(statement.name.text, "type");
				continue;
			}
			if (ts.isVariableStatement(statement)) {
				const declared = [];
				for (const declaration of statement.declarationList.declarations) {
					bindingNames(declaration.name, declared);
				}
				for (const name of declared) add(name, "value");
				continue;
			}
			if (statement.name && ts.isIdentifier(statement.name)) {
				add(statement.name.text, "value");
			}
		}
		visiting.delete(current);
		return { names, unresolved };
	};

	return read(path.resolve(file));
}

/** The report lines of one module: sorted names, types marked, star exports last. */
export function formatModuleExports({ names, unresolved }) {
	const lines = [...names]
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([name, kind]) => (kind === "type" ? `type ${name}` : name));
	for (const specifier of [...unresolved].sort()) {
		lines.push(`* from "${specifier}"`);
	}
	return lines;
}
