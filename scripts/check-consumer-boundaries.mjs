#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [path.join(ROOT, "apps")];
const VALID_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".mts", ".cts", ".svelte"]);

const FORBIDDEN_RULES = [
	{
		id: "workspace-source-import",
		description: "Do not import workspace package source paths",
		test: (specifier) => /^@pie-players\/[^/]+\/src\//.test(specifier),
	},
	{
		id: "custom-element-query-import",
		description: "Do not import package Svelte files via ?customElement",
		test: (specifier) => /^@pie-players\/.+\.svelte\?customElement$/.test(specifier),
	},
	{
		id: "raw-component-svelte-import",
		description: "Do not import package component .svelte files directly",
		test: (specifier) =>
			/^@pie-players\/[^/]+\/components\/.+\.svelte(?:\?.*)?$/.test(specifier),
	},
];

const importRegexes = [
	/\bfrom\s+["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const rel = (filePath) => path.relative(ROOT, filePath).replaceAll("\\", "/");

function walk(dirPath, visitor) {
	if (!existsSync(dirPath)) return;
	for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
		if (
			entry.name === "node_modules" ||
			entry.name === "dist" ||
			entry.name === "build" ||
			entry.name === ".svelte-kit"
		) {
			continue;
		}
		const fullPath = path.join(dirPath, entry.name);
		if (entry.isDirectory()) {
			walk(fullPath, visitor);
			continue;
		}
		visitor(fullPath);
	}
}

const violations = [];

for (const dir of TARGET_DIRS) {
	walk(dir, (filePath) => {
		const ext = path.extname(filePath);
		if (!VALID_EXTENSIONS.has(ext)) return;

		const content = readFileSync(filePath, "utf8");
		const specifiers = new Set();
		for (const regex of importRegexes) {
			regex.lastIndex = 0;
			let match = regex.exec(content);
			while (match) {
				specifiers.add(match[1]);
				match = regex.exec(content);
			}
		}

		for (const specifier of specifiers) {
			for (const rule of FORBIDDEN_RULES) {
				if (!rule.test(specifier)) continue;
				violations.push({
					file: rel(filePath),
					specifier,
					ruleId: rule.id,
					description: rule.description,
				});
			}
		}
	});
}

if (violations.length > 0) {
	console.error(
		`[check-consumer-boundaries] Found ${violations.length} import boundary violation(s)`,
	);
	for (const violation of violations) {
		console.error(
			`- ${violation.file}\n  ${violation.description} (${violation.ruleId})\n  import: ${violation.specifier}`,
		);
	}
	process.exit(1);
}

console.log("[check-consumer-boundaries] OK: no import boundary violations found");
