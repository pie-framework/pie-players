#!/usr/bin/env bun
/**
 * Fails on a class name outside the `pie-` namespace in the markup a light-DOM
 * custom element renders.
 *
 * A `shadow: "none"` element renders into the host page, so its classes are
 * public API and the page's stylesheets apply to them (AGENTS.md, "Custom
 * Element Import And Packaging Boundaries"). A generic or utility class there
 * either depends on a framework the host may not load — the TTS settings panel
 * shipped DaisyUI classes no PIE stylesheet defines — or collides with the
 * host's own rules. The scan covers each such element's template and every
 * component it renders: relative `.svelte` imports, and components a workspace
 * package re-exports from its root entry.
 *
 * Read from markup: static `class="…"` tokens, string literals inside a
 * `class="{…}"` expression, and `class:name` directives. Classes a script
 * writes are recorded in the element manifest instead.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

const ROOT = process.cwd();
const PACKAGES = join(ROOT, "packages");
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "build", ".turbo"]);

/**
 * Class names a light-DOM element may carry outside the namespace. Each is a
 * browser or platform hook with no styling, never a utility class.
 */
export const ALLOWED_CLASSES = new Set([
	// Opts the subtree out of page translation (Google Translate and others).
	"notranslate",
]);

const LIGHT_DOM = /customElement\s*=\s*\{\{[\s\S]*?shadow:\s*["']none["']/;

/** Blanks script, style and comments, keeping line numbers. */
const stripBlocks = (source) =>
	source.replace(
		/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g,
		(block) => block.replace(/[^\n]/g, " "),
	);

/** Splits a class attribute value into its static text and `{…}` expressions. */
function splitClassValue(value) {
	const text = [];
	const expressions = [];
	let depth = 0;
	let current = "";
	for (const char of value) {
		if (char === "{") {
			if (depth === 0) {
				text.push(current);
				current = "";
			} else current += char;
			depth += 1;
		} else if (char === "}" && depth > 0) {
			depth -= 1;
			if (depth === 0) {
				expressions.push(current);
				current = "";
			} else current += char;
		} else current += char;
	}
	(depth === 0 ? text : expressions).push(current);
	return { text: text.join(" "), expressions };
}

/** Every class name the markup of one component names, with its line. */
export function collectMarkupClasses(source) {
	const markup = stripBlocks(source);
	const found = [];
	const lineOf = (index) => markup.slice(0, index).split("\n").length;
	for (const match of markup.matchAll(/\bclass="([^"]*)"/g)) {
		const { text, expressions } = splitClassValue(match[1]);
		const names = text.split(/\s+/);
		for (const expression of expressions) {
			for (const literal of expression.matchAll(/(['`])([^'`]*)\1/g)) {
				names.push(...literal[2].split(/\s+/));
			}
		}
		for (const name of names.filter(Boolean)) {
			if (/[${}]/.test(name)) continue;
			found.push({ name, line: lineOf(match.index) });
		}
	}
	for (const match of markup.matchAll(/\bclass:([A-Za-z0-9_-]+)/g)) {
		found.push({ name: match[1], line: lineOf(match.index) });
	}
	return found;
}

export const isAllowedLightDomClass = (name) =>
	name.startsWith("pie-") || ALLOWED_CLASSES.has(name);

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRECTORIES.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (entry.endsWith(".svelte")) out.push(full);
	}
	return out;
}

/** Workspace package name → the `.svelte` components its root entry re-exports. */
function readPackageComponents() {
	const components = new Map();
	for (const entry of readdirSync(PACKAGES)) {
		const dir = join(PACKAGES, entry);
		const manifest = join(dir, "package.json");
		const index = join(dir, "index.ts");
		if (!existsSync(manifest) || !existsSync(index)) continue;
		const { name } = JSON.parse(readFileSync(manifest, "utf8"));
		const byExport = new Map();
		for (const match of readFileSync(index, "utf8").matchAll(
			/export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*["'](\.[^"']+\.svelte)["']/g,
		)) {
			byExport.set(match[1], normalize(join(dir, match[2])));
		}
		if (byExport.size > 0) components.set(name, byExport);
	}
	return components;
}

/** The components a file renders: relative imports and package re-exports. */
function renderedComponents(file, source, packageComponents) {
	const rendered = [];
	for (const match of source.matchAll(
		/import\s+(?:\w+\s*,\s*)?(?:\{([^}]*)\}|(\w+))?\s*from\s*["']([^"']+)["']/g,
	)) {
		const [, named, , specifier] = match;
		if (specifier.startsWith(".") && specifier.endsWith(".svelte")) {
			rendered.push(normalize(join(dirname(file), specifier)));
			continue;
		}
		const byExport = packageComponents.get(specifier);
		if (!byExport || !named) continue;
		for (const part of named.split(",")) {
			const imported = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, "");
			const component = byExport.get(imported);
			if (component) rendered.push(component);
		}
	}
	return rendered.filter((path) => existsSync(path));
}

export function findLightDomClassViolations() {
	const packageComponents = readPackageComponents();
	const roots = walk(PACKAGES).filter((file) =>
		LIGHT_DOM.test(readFileSync(file, "utf8")),
	);
	const reachedFrom = new Map(roots.map((file) => [file, file]));
	const queue = [...roots];
	while (queue.length > 0) {
		const file = queue.shift();
		const source = readFileSync(file, "utf8");
		for (const component of renderedComponents(
			file,
			source,
			packageComponents,
		)) {
			if (reachedFrom.has(component)) continue;
			reachedFrom.set(component, reachedFrom.get(file));
			queue.push(component);
		}
	}
	const violations = [];
	for (const [file, root] of reachedFrom) {
		for (const { name, line } of collectMarkupClasses(
			readFileSync(file, "utf8"),
		)) {
			if (isAllowedLightDomClass(name)) continue;
			violations.push({
				file: relative(ROOT, file),
				line,
				name,
				element: relative(ROOT, root),
			});
		}
	}
	return { scanned: reachedFrom.size, elements: roots.length, violations };
}

function main() {
	const { scanned, elements, violations } = findLightDomClassViolations();
	if (violations.length > 0) {
		console.error(
			`[check-light-dom-classes] Found ${violations.length} class name(s) outside the pie- namespace in light-DOM markup`,
		);
		for (const { file, line, name, element } of violations) {
			const via = element === file ? "" : ` (rendered by ${element})`;
			console.error(`- ${file}:${line} class "${name}"${via}`);
		}
		console.error(
			"\nA shadow: \"none\" element renders into the host page: name each class pie-<element>__… and define it in the component's own styles.",
		);
		process.exit(1);
	}
	console.log(
		`[check-light-dom-classes] OK: ${elements} light-DOM element(s), ${scanned} component(s), every class in the pie- namespace`,
	);
}

if (import.meta.main) main();
