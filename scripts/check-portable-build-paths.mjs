#!/usr/bin/env bun
/** Reject build-machine paths in every publishable package's built artifacts. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { getPublishablePackages } from "./lib/pack-inspection.mjs";

const EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".map", ".css", ".json"]);
// Handle both JSON-escaped Windows paths and escaped POSIX separators.
const normalize = (value) => value.replace(/\\\//g, "/").replace(/\\+/g, "/");
// Require a literal boundary so a CDN URL containing /home/.../node_modules
// is not mistaken for a build-machine path. file: URLs are still local paths.
const ABSOLUTE_DEPENDENCY_PATH = /(?:^|[\s"'`(=:\[])(?:file:\/\/)?(?:\/(?:[Uu]sers|home)\/[^"'`\r\n]+|\/(?:tmp|opt|private\/var)(?:\/[^"'`\r\n]*)?|[A-Za-z]:(?:\/[^"'`\r\n]*)?)\/(?:node_modules|\.bun)\//m;

export function buildPathLeak(source, root) {
	const normalized = normalize(source);
	if (normalized.includes(normalize(path.resolve(root)))) return "checkout path";
	if (ABSOLUTE_DEPENDENCY_PATH.test(normalized)) return "absolute dependency path";
	return null;
}

export function inspectBuildPaths(root = process.cwd()) {
	const violations = [];
	const missingOutputs = [];
	let files = 0;
	const packages = getPublishablePackages({ root });
	if (!packages.length) missingOutputs.push("no publishable packages found");
	for (const { dir, pkg } of packages) {
		const before = files;
		const collect = (directory) => {
			for (const entry of readdirSync(directory, { withFileTypes: true })) {
				const file = path.join(directory, entry.name);
				if (entry.isDirectory()) {
					collect(file);
				} else if (entry.isFile() && (EXTENSIONS.has(path.extname(entry.name)) || entry.name.endsWith(".d.ts"))) {
					files++;
					const reason = buildPathLeak(readFileSync(file, "utf8"), root);
					if (reason) violations.push({ file: path.relative(root, file), reason });
				}
			}
		};
		const dist = path.join(dir, "dist");
		if (existsSync(dist)) collect(dist);
		if (files === before) missingOutputs.push(`${pkg.name}: no built artifacts; run bun run build first`);
	}
	return { files, violations, missingOutputs };
}

if (import.meta.main) {
	const { files, violations, missingOutputs } = inspectBuildPaths();
	const failures = [...missingOutputs, ...violations.map(({ file, reason }) => `${file} (${reason})`)];
	if (failures.length) {
		console.error(`[check-portable-build-paths] ${failures.length} issue(s):\n${failures.map((issue) => `- ${issue}`).join("\n")}`);
		process.exit(1);
	}
	console.log(`[check-portable-build-paths] OK: ${files} built artifacts contain no build-machine paths`);
}
