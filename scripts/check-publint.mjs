#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROOT_PACKAGE_JSON = path.join(ROOT, "package.json");

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

const getPublishedEntryTargets = (pkg) => {
	const targets = new Set();
	collectTargets(pkg.exports, targets);
	collectTargets(pkg.main, targets);
	collectTargets(pkg.module, targets);
	collectTargets(pkg.types, targets);
	return [...targets]
		.filter((target) => typeof target === "string" && target.startsWith("./"))
		.filter((target) => !target.includes("*"));
};

const run = () => {
	const packageDirs = getWorkspaceDirs();
	const failures = [];
	let checked = 0;

	for (const dir of packageDirs) {
		const pkg = readJson(path.join(dir, "package.json"));
		if (pkg.private) continue;
		checked += 1;
		try {
			const publishedTargets = getPublishedEntryTargets(pkg);
			const missingTargets = publishedTargets.filter(
				(target) => !existsSync(path.join(dir, target)),
			);
			const relativeDir = path.relative(ROOT, dir);
			const isToolWorkspace = relativeDir.startsWith("tools/");
			if ((missingTargets.length > 0 || isToolWorkspace) && pkg.scripts?.build) {
				execSync("rm -rf dist tsconfig.tsbuildinfo && bun run build", {
					cwd: dir,
					stdio: "pipe",
				});
			}

			execSync("bunx publint .", {
				cwd: dir,
				stdio: "pipe",
			});
		} catch (error) {
			failures.push({
				name: pkg.name || path.basename(dir),
				dir: path.relative(ROOT, dir),
				error: [error.stdout?.toString(), error.stderr?.toString(), error.message]
					.filter(Boolean)
					.join("\n"),
			});
		}
	}

	if (failures.length > 0) {
		console.error(
			`[check-publint] Found ${failures.length} package(s) with publint issues`,
		);
		for (const failure of failures) {
			console.error(`\n- ${failure.name} (${failure.dir})`);
			console.error(failure.error.trim());
		}
		process.exit(1);
	}

	console.log(`[check-publint] OK: validated ${checked} publishable package(s)`);
};

run();
