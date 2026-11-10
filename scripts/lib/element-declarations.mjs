import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/** Tag names an `HTMLElementTagNameMap` interface in this declaration text maps. */
export function tagNameMapKeys(declarationText, fileName = "input.d.ts") {
	const source = ts.createSourceFile(fileName, declarationText, ts.ScriptTarget.ES2022, true);
	const keys = new Set();
	const visit = (node) => {
		if (ts.isInterfaceDeclaration(node) && node.name.text === "HTMLElementTagNameMap") {
			for (const member of node.members) {
				const name = member.name;
				if (name && (ts.isStringLiteral(name) || ts.isIdentifier(name))) keys.add(name.text);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return keys;
}

/** Relative module specifiers a declaration text imports, re-exports or references. */
export function relativeSpecifiers(declarationText, fileName = "input.d.ts") {
	const source = ts.createSourceFile(fileName, declarationText, ts.ScriptTarget.ES2022, true);
	const specifiers = new Set();
	const add = (node) => {
		if (node && ts.isStringLiteralLike(node) && node.text.startsWith(".")) specifiers.add(node.text);
	};
	const visit = (node) => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier
		) {
			add(node.moduleSpecifier);
		} else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
			add(node.argument.literal);
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	for (const reference of source.referencedFiles) {
		if (reference.fileName.startsWith(".")) specifiers.add(reference.fileName);
	}
	return [...specifiers];
}

const stringsUnderTypesKeys = (value, key, found) => {
	if (typeof value === "string") {
		if (key === "types") found.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) stringsUnderTypesKeys(entry, key, found);
		return;
	}
	if (value && typeof value === "object") {
		for (const [name, entry] of Object.entries(value)) stringsUnderTypesKeys(entry, name, found);
	}
};

/** Declaration files a package names as `types` in its `exports`, `types` or `typings`. */
export function typesEntryFiles(packageDirectory, pkg) {
	const found = new Set();
	stringsUnderTypesKeys(pkg.exports, "", found);
	for (const field of ["types", "typings"]) {
		if (typeof pkg[field] === "string") found.add(pkg[field]);
	}
	return [...found]
		.map((entry) => path.resolve(packageDirectory, entry))
		.filter((file) => file.endsWith(".d.ts") && existsSync(file));
}

const resolveDeclaration = (from, specifier) => {
	const base = path.resolve(path.dirname(from), specifier);
	const stem = base.replace(/\.(?:js|mjs|cjs)$/, "");
	for (const candidate of [`${stem}.d.ts`, `${base}.d.ts`, path.join(base, "index.d.ts")]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
};

/** Declaration files reachable from `entries` through relative imports and re-exports. */
export function reachableDeclarations(entries) {
	const seen = new Set();
	const queue = [...entries];
	while (queue.length > 0) {
		const file = queue.pop();
		if (seen.has(file)) continue;
		seen.add(file);
		for (const specifier of relativeSpecifiers(readFileSync(file, "utf8"), file)) {
			const next = resolveDeclaration(file, specifier);
			if (next && !seen.has(next)) queue.push(next);
		}
	}
	return seen;
}

/** Tag names mapped by a declaration a consumer reaches from the package's type entries. */
export function declaredTagNames(packageDirectory, pkg) {
	const keys = new Set();
	for (const file of reachableDeclarations(typesEntryFiles(packageDirectory, pkg))) {
		for (const key of tagNameMapKeys(readFileSync(file, "utf8"), file)) keys.add(key);
	}
	return keys;
}

/** Tag names in the package's `customElements` manifest. */
export function manifestTagNames(packageDirectory, pkg) {
	if (typeof pkg.customElements !== "string") return [];
	const manifest = JSON.parse(readFileSync(path.join(packageDirectory, pkg.customElements), "utf8"));
	const tags = new Set();
	for (const module of manifest.modules ?? []) {
		for (const declaration of module.declarations ?? []) {
			if (typeof declaration.tagName === "string") tags.add(declaration.tagName);
		}
	}
	return [...tags];
}

/** Tags a package registers that no reachable declaration maps. */
export function undeclaredElementTags({ tags, declared }) {
	return [...new Set(tags)].filter((tag) => !declared.has(tag)).sort();
}
