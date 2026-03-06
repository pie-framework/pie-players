#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DEP = "@pie-lib/math-rendering-module";
const SOURCE_MANIFEST = path.join(
	ROOT,
	"packages",
	"players-shared",
	"package.json",
);
const DEP_SECTIONS = [
	"dependencies",
	"devDependencies",
	"peerDependencies",
	"optionalDependencies",
];
const WORKSPACE_ROOTS = ["packages", "apps", "tools"];

const fail = (message) => {
	console.error(`[check-math-rendering-version] ${message}`);
	process.exit(1);
};

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

if (!existsSync(SOURCE_MANIFEST)) {
	fail(`Missing source-of-truth manifest: ${path.relative(ROOT, SOURCE_MANIFEST)}`);
}

const sourceManifest = readJson(SOURCE_MANIFEST);
const sourceVersion = sourceManifest?.dependencies?.[TARGET_DEP];
if (typeof sourceVersion !== "string" || sourceVersion.length === 0) {
	fail(
		`Source manifest must declare dependencies.${TARGET_DEP} in ${path.relative(ROOT, SOURCE_MANIFEST)}`,
	);
}

const manifestPaths = [];
const rootManifest = path.join(ROOT, "package.json");
if (existsSync(rootManifest)) {
	manifestPaths.push(rootManifest);
}

for (const root of WORKSPACE_ROOTS) {
	const absRoot = path.join(ROOT, root);
	if (!existsSync(absRoot)) continue;

	for (const dirent of readdirSync(absRoot, { withFileTypes: true })) {
		if (!dirent.isDirectory()) continue;
		const manifestPath = path.join(absRoot, dirent.name, "package.json");
		if (existsSync(manifestPath)) {
			manifestPaths.push(manifestPath);
		}
	}
}

const occurrences = [];
const violations = [];

for (const manifestPath of manifestPaths) {
	const manifest = readJson(manifestPath);
	const packageName =
		manifest.name || path.relative(ROOT, path.dirname(manifestPath));

	for (const section of DEP_SECTIONS) {
		const deps = manifest[section];
		if (!deps || typeof deps !== "object") continue;
		if (!(TARGET_DEP in deps)) continue;

		const declared = deps[TARGET_DEP];
		occurrences.push({
			packageName,
			manifestPath,
			section,
			declared,
		});

		if (declared !== sourceVersion) {
			violations.push(
				`${packageName} (${path.relative(ROOT, manifestPath)}): ${section}.${TARGET_DEP} must be "${sourceVersion}" (from players-shared), found "${declared}"`,
			);
		}
	}
}

if (occurrences.length === 0) {
	fail(`No declarations of ${TARGET_DEP} found in workspace manifests.`);
}
if (occurrences.length !== 1) {
	const refs = occurrences
		.map(
			(entry) =>
				`- ${entry.packageName} (${path.relative(ROOT, entry.manifestPath)}): ${entry.section}.${TARGET_DEP} = "${entry.declared}"`,
		)
		.join("\n");
	fail(
		`Expected exactly 1 workspace declaration of ${TARGET_DEP} (in players-shared), found ${occurrences.length}:\n${refs}`,
	);
}

const bunLockPath = path.join(ROOT, "bun.lock");
if (!existsSync(bunLockPath)) {
	fail("Missing bun.lock");
}

const bunLock = readFileSync(bunLockPath, "utf8");
const lockVersions = new Set(
	[...bunLock.matchAll(/@pie-lib\/math-rendering-module@(\d+\.\d+\.\d+)/g)].map(
		(match) => match[1],
	),
);

if (lockVersions.size === 0) {
	violations.push(`bun.lock is missing ${TARGET_DEP} entries`);
} else {
	for (const version of lockVersions) {
		if (version !== sourceVersion) {
			violations.push(
				`bun.lock contains ${TARGET_DEP}@${version}; expected only ${sourceVersion} (from players-shared)`,
			);
		}
	}
}

if (violations.length > 0) {
	fail(`Found ${violations.length} violation(s):\n${violations.join("\n")}`);
}

// Optional local-install guard: if node_modules exists, ensure no stale Bun-installed versions remain.
const nodeModulesDir = path.join(ROOT, "node_modules");
if (existsSync(nodeModulesDir)) {
	const bunDir = path.join(nodeModulesDir, ".bun");
	if (existsSync(bunDir)) {
		const installedMathDirs = readdirSync(bunDir).filter((name) =>
			name.startsWith("@pie-lib+math-rendering-module@"),
		);
		if (installedMathDirs.length > 1) {
			fail(
				`Detected multiple locally installed ${TARGET_DEP} versions in node_modules/.bun: ${installedMathDirs.join(", ")}. Remove stale installs and re-run bun install.`,
			);
		}
		if (
			installedMathDirs.length === 1 &&
			!installedMathDirs[0].startsWith(
				`@pie-lib+math-rendering-module@${sourceVersion}`,
			)
		) {
			fail(
				`Local Bun install uses ${installedMathDirs[0]}, expected version ${sourceVersion}. Reinstall dependencies.`,
			);
		}
	}

	const rootLink = path.join(nodeModulesDir, "@pie-lib", "math-rendering-module");
	if (existsSync(rootLink)) {
		const stat = lstatSync(rootLink);
		if (stat.isSymbolicLink()) {
			const target = realpathSync(rootLink);
			if (!target.includes(`@pie-lib+math-rendering-module@${sourceVersion}`)) {
				fail(
					`Root symlink for ${TARGET_DEP} points to unexpected target: ${target}. Expected version ${sourceVersion}.`,
				);
			}
		}
	}
}

console.log(
	`[check-math-rendering-version] OK: ${TARGET_DEP} is sourced from players-shared (${sourceVersion}) and consistent in bun.lock`,
);
