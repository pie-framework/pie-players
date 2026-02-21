#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");

const ALLOWED_SOURCE_EXPORT_PATTERNS = new Map([
	[
		"@pie-players/pie-assessment-player",
		[
			/^\.\/src\/player\/AssessmentLayout\.svelte$/,
			/^\.\/src\/reference-layout\/ReferenceLayout\.svelte$/,
			/^\.\/src\/components\/AssessmentItemList\.svelte$/,
			/^\.\/src\/components\/AssessmentSectionList\.svelte$/,
		],
	],
	[
		"@pie-players/pie-assessment-toolkit",
		[
			/^\.\/src\/components\/QuestionToolBar\.svelte$/,
			/^\.\/src\/components\/PNPProvenanceViewer\.svelte$/,
			/^\.\/src\/components\/PNPProfileTester\.svelte$/,
		],
	],
	[
		"@pie-players/pie-calculator-mathjs",
		[/^\.\/src\/components\/Calculator\.svelte$/],
	],
	[
		"@pie-players/pie-players-shared",
		[
			/^\.\/src\/components\/index\.ts$/,
			/^\.\/src\/components\/PieItemPlayer\.svelte$/,
			/^\.\/src\/components\/PieSpinner\.svelte$/,
			/^\.\/src\/components\/ToolSettingsButton\.svelte$/,
			/^\.\/src\/components\/ToolSettingsPanel\.svelte$/,
			/^\.\/src\/components\/PiePreviewToggle\.svelte$/,
			/^\.\/src\/components\/PiePreviewLayout\.svelte$/,
			/^\.\/src\/i18n\/use-i18n\.svelte\.ts$/,
			/^\.\/src\/i18n\/use-i18n-standalone\.svelte\.ts$/,
		],
	],
	[
		"@pie-players/pie-section-player",
		[/^\.\/src\/PieSectionPlayer\.svelte$/],
	],
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

	const allowedPatterns = ALLOWED_SOURCE_EXPORT_PATTERNS.get(name);
	if (!allowedPatterns) {
		violations.push({
			name,
			dir,
			sourceTargets,
			reason:
				"package has source exports but is not allowlisted for source-based entrypoints",
		});
		continue;
	}

	const unexpectedTargets = sourceTargets.filter(
		(target) => !allowedPatterns.some((pattern) => pattern.test(target)),
	);
	if (unexpectedTargets.length > 0) {
		violations.push({
			name,
			dir,
			sourceTargets: unexpectedTargets,
			reason:
				"package has source exports outside its approved source entrypoint contract",
		});
	}
}

if (violations.length > 0) {
	console.error(
		`[check-source-exports] Found ${violations.length} package(s) with unexpected source exports`,
	);
	for (const violation of violations) {
		console.error(`\n- ${violation.name} (${violation.dir})`);
		if (violation.reason) {
			console.error(`  reason: ${violation.reason}`);
		}
		for (const target of violation.sourceTargets) {
			console.error(`  - ${target}`);
		}
	}
	process.exit(1);
}

console.log(
	`[check-source-exports] OK: validated ${checked} publishable package(s)`,
);
