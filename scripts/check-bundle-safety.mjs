#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EVAL_REQUIRE_PATTERN = /eval\((["'])require\1\)/;

const TARGET_DIRS = [
	"packages/item-player/dist",
	"packages/section-player/dist",
];

function collectJsFiles(dir) {
	const entries = readdirSync(dir);
	const files = [];

	for (const entry of entries) {
		const absPath = path.join(dir, entry);
		const stats = statSync(absPath);
		if (stats.isDirectory()) {
			files.push(...collectJsFiles(absPath));
			continue;
		}
		if (entry.endsWith(".js")) {
			files.push(absPath);
		}
	}

	return files;
}

const failures = [];
let filesChecked = 0;

for (const targetDir of TARGET_DIRS) {
	const absTargetDir = path.join(ROOT, targetDir);
	if (!existsSync(absTargetDir)) {
		failures.push(`[bundle-safety] missing build output directory: ${targetDir}`);
		continue;
	}

	for (const filePath of collectJsFiles(absTargetDir)) {
		filesChecked += 1;
		const content = readFileSync(filePath, "utf8");
		if (EVAL_REQUIRE_PATTERN.test(content)) {
			const relPath = path.relative(ROOT, filePath);
			failures.push(
				`[bundle-safety] unsafe eval(require) pattern found in ${relPath}`,
			);
		}
	}
}

if (failures.length > 0) {
	console.error(
		`[check-bundle-safety] Found ${failures.length} bundle safety issue(s)`,
	);
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	`[check-bundle-safety] OK: validated ${filesChecked} JS bundle file(s)`,
);
