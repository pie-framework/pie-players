#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");
const ATTW_EXCLUDED = new Set([
	"@pie-players/pie-assessment-toolkit",
	"@pie-players/pie-calculator-mathjs",
	"@pie-players/pie-players-shared",
	"@pie-players/pie-section-player",
	"@pie-players/pie-theme",
	"@pie-players/pie-theme-daisyui",
	"@pie-players/pie-tool-annotation-toolbar",
	"@pie-players/pie-tool-tts-inline",
]);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

const getWorkspaceDirs = () => {
	const rootPkg = readJson(ROOT_PACKAGE_JSON);
	const workspaces = Array.isArray(rootPkg.workspaces)
		? rootPkg.workspaces
		: [];
	const dirs = new Set();

	for (const workspace of workspaces) {
		if (typeof workspace !== "string") continue;
		if (!workspace.startsWith("packages/") && !workspace.startsWith("tools/")) {
			continue;
		}
		if (workspace.endsWith("/*")) {
			const parent = path.join(ROOT, workspace.slice(0, -2));
			if (!existsSync(parent)) continue;
			for (const entry of readdirSync(parent, { withFileTypes: true })) {
				if (entry.isDirectory()) {
					dirs.add(path.join(parent, entry.name));
				}
			}
			continue;
		}
		dirs.add(path.join(ROOT, workspace));
	}

	return [...dirs].filter((dir) => existsSync(path.join(dir, "package.json")));
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		if (ATTW_EXCLUDED.has(pkg.name)) continue;
		checked += 1;
		try {
			execSync("bunx attw --pack --ignore-rules cjs-resolves-to-esm -- .", {
				cwd: dir,
				stdio: "pipe",
			});
		} catch (error) {
			const stdout = error.stdout?.toString()?.trim();
			const stderr = error.stderr?.toString()?.trim();
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [stdout, stderr, error.message].filter(Boolean).join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-attw] Found ${failures.length} package(s) with declaration issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(`[check-attw] OK: validated ${checked} publishable package(s)`);
	if (ATTW_EXCLUDED.size > 0) {
		console.log(
			`[check-attw] Skipped ${ATTW_EXCLUDED.size} package(s) with known ATTW false-positive/legacy type-surface gaps`,
		);
	}
};

run();
