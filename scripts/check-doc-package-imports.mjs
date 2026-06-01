#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PACKAGES_DIR = path.join(ROOT, "packages");
const APPS_DIR = path.join(ROOT, "apps");
const TOOLS_DIR = path.join(ROOT, "tools");
const SKIP_DIRS = new Set([
	".git",
	".svelte-kit",
	"dist",
	"node_modules",
	"coverage",
	"local-builds",
]);
const DOC_FILE_NAMES = new Set([
	"README.md",
	"readme.md",
	"ARCHITECTURE.md",
	"USAGE_EXAMPLE.md",
	"AGENTS.md",
	"GETTING-STARTED.md",
	"INTEGRATION-GUIDE.md",
]);
const ALLOWED_EXTERNAL_PACKAGES = new Set([
	"@pie-players/pie-preloaded-player",
]);

const toPosix = (value) => value.replaceAll(path.sep, "/");
const rel = (filePath) => toPosix(path.relative(ROOT, filePath));
const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const isMarkdownDoc = (filePath) => {
	const relative = rel(filePath);
	const base = path.basename(filePath);
	if (!filePath.endsWith(".md")) return false;
	if (base === "CHANGELOG.md") return false;
	if (relative.startsWith("docs/")) return true;
	if (/^packages\/[^/]+\/docs\//.test(relative)) return true;
	if (relative.startsWith("packages/")) return DOC_FILE_NAMES.has(base);
	if (relative.startsWith("apps/")) return DOC_FILE_NAMES.has(base);
	return DOC_FILE_NAMES.has(base);
};

const walk = (dir, visitor) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!SKIP_DIRS.has(entry.name)) {
				walk(path.join(dir, entry.name), visitor);
			}
			continue;
		}
		visitor(path.join(dir, entry.name));
	}
};

const collectPackageExports = () => {
	const packages = new Map();
	for (const workspaceDir of [PACKAGES_DIR, APPS_DIR, TOOLS_DIR]) {
		if (!existsSync(workspaceDir)) continue;
		for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const packageJsonPath = path.join(
				workspaceDir,
				entry.name,
				"package.json",
			);
			if (!existsSync(packageJsonPath)) continue;

			const manifest = readJson(packageJsonPath);
			if (!manifest.name?.startsWith("@pie-players/")) continue;

			const exportKeys =
				typeof manifest.exports === "string"
					? new Set(["."])
					: new Set(
							Object.keys(manifest.exports ?? { ".": manifest.main ?? "" }),
						);
			const distImportTargets = collectDistImportTargets(manifest);

			packages.set(manifest.name, {
				manifestPath: packageJsonPath,
				exportKeys,
				distImportTargets,
			});
		}
	}
	return packages;
};

const collectDistImportTargets = (manifest) => {
	const targets = new Set();
	const addTarget = (value) => {
		if (typeof value === "string") {
			if (value.startsWith("./dist/")) targets.add(value);
			return;
		}
		if (value && typeof value === "object") {
			for (const nested of Object.values(value)) {
				addTarget(nested);
			}
		}
	};

	addTarget(manifest.main);
	addTarget(manifest.module);
	addTarget(manifest.browser);
	addTarget(manifest.unpkg);
	addTarget(manifest.jsdelivr);
	addTarget(manifest.exports);
	return targets;
};

const getPackageImport = (specifier) => {
	const parts = specifier.split("/");
	const packageName = parts.slice(0, 2).join("/");
	const rest = parts.slice(2).join("/");
	return {
		packageName,
		subpath: rest ? `./${rest}` : ".",
	};
};

const lineNumberForIndex = (content, index) =>
	content.slice(0, index).split(/\r?\n/).length;

const extractPackageReferences = (content) => {
	const references = [];
	const packageReferencePattern =
		/@pie-players\/[A-Za-z0-9_-]+(?:@[A-Za-z0-9_.+-]+)?(?:\/[A-Za-z0-9_.-]+)*/g;
	let match = packageReferencePattern.exec(content);
	while (match) {
		const rawSpecifier = match[0];
		const specifier = rawSpecifier.replace(
			/^(@pie-players\/[^/@]+)@[^/]+/,
			"$1",
		);
		const prefix = content.slice(Math.max(0, match.index - 20), match.index);
		const suffix = content.slice(match.index + rawSpecifier.length);
		const isWildcardReference =
			suffix.startsWith("*") || suffix.startsWith("/*");
		const isContextSymbol = /Symbol\.for\(\s*["']$/.test(prefix);
		if (!isWildcardReference && !isContextSymbol) {
			references.push({
				specifier,
				rawSpecifier,
				line: lineNumberForIndex(content, match.index),
			});
		}
		match = packageReferencePattern.exec(content);
	}
	return references;
};

const packages = collectPackageExports();
const failures = [];

walk(ROOT, (filePath) => {
	if (!isMarkdownDoc(filePath)) return;

	const content = readFileSync(filePath, "utf8");
	for (const { specifier, rawSpecifier, line } of extractPackageReferences(
		content,
	)) {
		const { packageName, subpath } = getPackageImport(specifier);
		if (ALLOWED_EXTERNAL_PACKAGES.has(packageName)) continue;

		const packageInfo = packages.get(packageName);
		if (!packageInfo) {
			failures.push(
				`${rel(filePath)}:${line} references unknown workspace package ${packageName}`,
			);
			continue;
		}
		if (subpath.startsWith("./dist/")) {
			if (!packageInfo.distImportTargets.has(subpath)) {
				failures.push(
					`${rel(filePath)}:${line} references ${rawSpecifier}, but ${rel(
						packageInfo.manifestPath,
					)} does not expose built file ${subpath}`,
				);
			}
			continue;
		}
		if (!packageInfo.exportKeys.has(subpath)) {
			failures.push(
				`${rel(filePath)}:${line} references ${rawSpecifier}, but ${rel(
					packageInfo.manifestPath,
				)} does not export ${subpath}`,
			);
		}
	}
});

if (failures.length > 0) {
	console.error("Documentation package import check failed:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log("Documentation package import check passed.");
