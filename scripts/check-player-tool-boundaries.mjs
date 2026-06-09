#!/usr/bin/env node

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import path from "node:path";

const DEFAULT_ROOT = process.cwd();
const CONCRETE_TOOL_PACKAGE_PATTERN = /^@pie-players\/pie-tool-/;
const TOOL_IMPORT_PATTERN =
	/(?:from\s*|import\s*\(\s*|import\s+)["'](@pie-players\/pie-tool-[^"']+)["']/g;
const TOOL_PACKAGE_STRING_PATTERN = /["'](@pie-players\/pie-tool-[^"']+)["']/g;
const DIST_CONCRETE_CHUNK_PATTERN =
	/(?:^|[/\\])(?:pie-tool-|tool-tts-inline|tool-calculator|calculator-desmos)[^/\\]*\.js$/i;
const MATH_RENDERING_MARKER = "@pie-lib/math-rendering-module";

const SOURCE_IMPORT_TARGETS = [
	"packages/section-player/src",
	"packages/assessment-toolkit/src",
];

const BOUNDARY_PACKAGE_DIRS = [
	"packages/section-player",
	"packages/assessment-toolkit",
];

const DIST_IMPORT_TARGETS = [
	"packages/section-player/dist",
	"packages/assessment-toolkit/dist",
];
const GENERATED_DIR_NAMES = new Set(["node_modules"]);

const FORBIDDEN_MANIFESTS = [
	"packages/section-player/package.json",
	"packages/assessment-toolkit/package.json",
];

function collectFiles(dir, predicate = () => true) {
	const entries = readdirSync(dir);
	const files = [];

	for (const entry of entries) {
		const absPath = path.join(dir, entry);
		const stats = statSync(absPath);
		if (stats.isDirectory()) {
			if (GENERATED_DIR_NAMES.has(entry)) continue;
			files.push(...collectFiles(absPath, predicate));
			continue;
		}
		if (predicate(absPath)) {
			files.push(absPath);
		}
	}

	return files;
}

function relative(root, absPath) {
	return path.relative(root, absPath).split(path.sep).join("/");
}

function collectImportMatches(content, pattern = TOOL_IMPORT_PATTERN) {
	pattern.lastIndex = 0;
	const matches = [];
	let match;
	while ((match = pattern.exec(content))) {
		matches.push(match[1]);
	}
	return matches;
}

function addMissingPathFailure(failures, label, relPath) {
	failures.push(`[tool-boundary] missing ${label}: ${relPath}`);
}

function isCheckedDistPath(relPath) {
	return DIST_IMPORT_TARGETS.some((target) => relPath.startsWith(`${target}/`));
}

function checkSourceImports(root, failures) {
	for (const relDir of SOURCE_IMPORT_TARGETS) {
		const absDir = path.join(root, relDir);
		if (!existsSync(absDir)) {
			addMissingPathFailure(failures, "source directory", relDir);
			continue;
		}

		const files = collectFiles(absDir, (filePath) =>
			/\.(svelte|ts|tsx|js|mjs)$/.test(filePath),
		);
		for (const filePath of files) {
			const content = readFileSync(filePath, "utf8");
			for (const packageName of collectImportMatches(content)) {
				failures.push(
					`[tool-boundary] ${relative(root, filePath)} imports ${packageName}; move concrete tool loading behind @pie-players/pie-default-tool-loaders.`,
				);
			}
		}
	}
}

function checkDistImports(root, failures) {
	for (const relDir of DIST_IMPORT_TARGETS) {
		const absDir = path.join(root, relDir);
		if (!existsSync(absDir)) {
			addMissingPathFailure(failures, "dist directory", relDir);
			continue;
		}

		const files = collectFiles(absDir, (filePath) => filePath.endsWith(".js"));
		for (const filePath of files) {
			const relPath = relative(root, filePath);
			const content = readFileSync(filePath, "utf8");
			for (const packageName of collectImportMatches(content)) {
				failures.push(
					`[tool-boundary] ${relPath} imports concrete tool package ${packageName}; depend on @pie-players/pie-default-tool-loaders instead.`,
				);
			}
			if (
				isCheckedDistPath(relPath) &&
				DIST_CONCRETE_CHUNK_PATTERN.test(relPath)
			) {
				failures.push(
					`[tool-boundary] player/toolkit dist includes concrete tool chunk: ${relPath}`,
				);
			}
			if (
				isCheckedDistPath(relPath) &&
				content.includes(MATH_RENDERING_MARKER)
			) {
				failures.push(
					`[tool-boundary] ${relPath} includes ${MATH_RENDERING_MARKER}; calculator internals must stay behind @pie-players/pie-default-tool-loaders.`,
				);
			}
		}
	}
}

function checkManifest(root, relPath, failures) {
	const absPath = path.join(root, relPath);
	if (!existsSync(absPath)) {
		addMissingPathFailure(failures, "manifest", relPath);
		return;
	}

	const manifest = JSON.parse(readFileSync(absPath, "utf8"));
	for (const field of [
		"dependencies",
		"peerDependencies",
		"devDependencies",
		"optionalDependencies",
	]) {
		const deps = manifest[field] || {};
		for (const packageName of Object.keys(deps)) {
			if (CONCRETE_TOOL_PACKAGE_PATTERN.test(packageName)) {
				failures.push(
					`[tool-boundary] ${relPath} declares ${packageName} in ${field}; section-player/toolkit must depend on @pie-players/pie-default-tool-loaders, not concrete tools.`,
				);
			}
		}
	}
}

function checkForbiddenManifests(root, failures) {
	for (const relPath of FORBIDDEN_MANIFESTS) {
		checkManifest(root, relPath, failures);
	}
}

function checkPackageTsconfigs(root, failures) {
	for (const relDir of BOUNDARY_PACKAGE_DIRS) {
		const absDir = path.join(root, relDir);
		if (!existsSync(absDir)) {
			addMissingPathFailure(failures, "package directory", relDir);
			continue;
		}
		const files = collectFiles(absDir, (filePath) =>
			/(^|[/\\])tsconfig[^/\\]*\.json$/.test(filePath),
		);
		for (const filePath of files) {
			const relPath = relative(root, filePath);
			const tsconfig = JSON.parse(readFileSync(filePath, "utf8"));
			const paths = tsconfig.compilerOptions?.paths || {};
			for (const packageName of Object.keys(paths)) {
				if (CONCRETE_TOOL_PACKAGE_PATTERN.test(packageName)) {
					failures.push(
						`[tool-boundary] ${relPath} maps concrete tool package ${packageName}; player/toolkit packages must not type-resolve implementation packages directly.`,
					);
				}
			}
		}
	}
}

function checkSectionPlayerViteConfig(root, failures) {
	const relPath = "packages/section-player/vite.config.ts";
	const absPath = path.join(root, relPath);
	if (!existsSync(absPath)) {
		addMissingPathFailure(failures, "vite config", relPath);
		return;
	}
	const content = readFileSync(absPath, "utf8");
	for (const packageName of collectImportMatches(
		content,
		TOOL_PACKAGE_STRING_PATTERN,
	)) {
		failures.push(
			`[tool-boundary] ${relPath} names concrete tool package ${packageName}; externalize @pie-players/pie-default-tool-loaders only.`,
		);
	}
}

export function checkPlayerToolBoundaries(root = DEFAULT_ROOT) {
	const failures = [];

	checkSourceImports(root, failures);
	checkDistImports(root, failures);
	checkForbiddenManifests(root, failures);
	checkPackageTsconfigs(root, failures);
	checkSectionPlayerViteConfig(root, failures);

	return failures;
}

if (import.meta.main) {
	const failures = checkPlayerToolBoundaries(DEFAULT_ROOT);

	if (failures.length > 0) {
		console.error(
			`[check-player-tool-boundaries] Found ${failures.length} tool boundary issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log("[check-player-tool-boundaries] OK: player tool boundaries hold");
}
