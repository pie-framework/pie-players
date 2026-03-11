#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const ASSESSMENT_TOOLKIT_TYPES_DIR = path.join(
	ROOT,
	"packages/assessment-toolkit/src/types",
);

const ALLOWED_SOURCE_EXPORT_PACKAGES = new Set([
	"@pie-players/pie-players-shared",
	"@pie-players/pie-print-player",
]);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const getWorkspaceDirs = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, workspace.slice(0, -2));
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					dirs.add(path.join(parent, entry.name));
				}
			}
		} else {
			dirs.add(path.join(ROOT, workspace));
		}
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const collectTargets = (value, out) => {
	if (!value) return;
	if (typeof value === "string") {
		out.add(value);
		return;
	}
	if (Array.isArray(value)) {
		for (const entry of value) collectTargets(entry, out);
		return;
	}
	if (typeof value === "object") {
		for (const entry of Object.values(value)) collectTargets(entry, out);
	}
};

const collectFilesByExtension = (dir, extension, out = []) => {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectFilesByExtension(fullPath, extension, out);
			continue;
		}
		if (entry.isFile() && fullPath.endsWith(extension)) {
			out.push(fullPath);
		}
	}
	return out;
};

const violations = [];
let checked = 0;

for (const dir of getWorkspaceDirs()) {
	const pkg = readJson(path.join(dir, "package.json"));
	if (pkg.private) continue;

	checked += 1;
	const name = pkg.name || path.basename(dir);
	const targets = new Set();
	collectTargets(pkg.exports, targets);

	const sourceTargets = [...targets]
		.filter((target) => typeof target === "string" && target.startsWith("./src/"))
		.sort();

	if (sourceTargets.length === 0) continue;
	if (ALLOWED_SOURCE_EXPORT_PACKAGES.has(name)) continue;

	violations.push({
		name,
		dir,
		sourceTargets,
	});
}

const forbiddenAmbientModules = [];
const dtsFiles = collectFilesByExtension(ASSESSMENT_TOOLKIT_TYPES_DIR, ".d.ts");
const ambientModulePattern = /declare\s+module\s+["']@pie-players\/(pie-tool-|pie-calculator-desmos|tts-client-server)/g;
for (const file of dtsFiles) {
	const content = readFileSync(file, "utf8");
	const matches = [...content.matchAll(ambientModulePattern)].map(
		(match) => match[0],
	);
	if (matches.length === 0) continue;
	forbiddenAmbientModules.push({
		file,
		declarations: matches,
	});
}

if (violations.length > 0) {
	console.error(
		`[check-source-exports] Found ${violations.length} package(s) with unexpected source exports`,
	);
	for (const violation of violations) {
		console.error(`\n- ${violation.name} (${violation.dir})`);
		for (const target of violation.sourceTargets) {
			console.error(`  - ${target}`);
		}
	}
	process.exit(1);
}

if (forbiddenAmbientModules.length > 0) {
	console.error(
		`[check-source-exports] Found ${forbiddenAmbientModules.length} file(s) with forbidden ambient tool module declarations`,
	);
	for (const violation of forbiddenAmbientModules) {
		console.error(`\n- ${violation.file}`);
		for (const declaration of violation.declarations) {
			console.error(`  - ${declaration}`);
		}
	}
	process.exit(1);
}

console.log(
	`[check-source-exports] OK: validated ${checked} publishable package(s)`,
);
