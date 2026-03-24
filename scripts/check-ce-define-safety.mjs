#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH_ROOT = path.join(ROOT, "packages");
const SOURCE_EXTENSIONS = new Set([".ts", ".js", ".mjs"]);
const ALLOWED_DIRECT_DEFINE_FILES = new Set([
	"packages/players-shared/src/pie/custom-element-define.ts",
	"packages/print-player/src/ce-registry.ts",
	"packages/theme/src/theme-element.ts",
	"packages/assessment-toolkit/scripts/build-ce-components.mjs",
]);
const DIRECT_DEFINE_PATTERN = /customElements\.define\s*\(/g;
const LITERAL_DEFINE_PATTERN =
	/(?:defineCustomElementSafely|customElements\.define)\(\s*["']([^"']+)["']/g;
const stripComments = (value) =>
	value
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");

const shouldSkipDir = (name) =>
	name === "node_modules" ||
	name === "dist" ||
	name === ".svelte-kit" ||
	name === "coverage" ||
	name === ".turbo" ||
	name === "build" ||
	name === "__tests__" ||
	name === "tests";

const collectSourceFiles = (dir, out) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const absPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!shouldSkipDir(entry.name)) {
				collectSourceFiles(absPath, out);
			}
			continue;
		}
		const ext = path.extname(entry.name);
		if (SOURCE_EXTENSIONS.has(ext)) {
			out.push(absPath);
		}
	}
};

const relPath = (absPath) => path.relative(ROOT, absPath).replace(/\\/g, "/");

const files = [];
if (existsSync(SEARCH_ROOT)) {
	collectSourceFiles(SEARCH_ROOT, files);
}

const failures = [];
const literalTagOwners = new Map();

for (const file of files) {
	const relative = relPath(file);
	const content = stripComments(readFileSync(file, "utf8"));

	DIRECT_DEFINE_PATTERN.lastIndex = 0;
	if (
		DIRECT_DEFINE_PATTERN.test(content) &&
		!ALLOWED_DIRECT_DEFINE_FILES.has(relative)
	) {
		failures.push(
			`[direct-define] ${relative} uses customElements.define directly; use defineCustomElementSafely instead`,
		);
	}

	LITERAL_DEFINE_PATTERN.lastIndex = 0;
	for (const match of content.matchAll(LITERAL_DEFINE_PATTERN)) {
		const tag = match[1];
		if (!tag) continue;
		if (!literalTagOwners.has(tag)) {
			literalTagOwners.set(tag, new Set());
		}
		literalTagOwners.get(tag).add(relative);
	}
}

for (const [tag, owners] of literalTagOwners.entries()) {
	if (owners.size > 1) {
		failures.push(
			`[duplicate-literal-tag] "${tag}" is defined in multiple files: ${[...owners].sort().join(", ")}`,
		);
	}
}

if (failures.length > 0) {
	console.error(
		`[check-ce-define-safety] Found ${failures.length} custom-element registration safety issue(s)`,
	);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-ce-define-safety] OK: validated ${files.length} source files for safe custom-element registration`,
);
