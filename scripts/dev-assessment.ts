#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

const assessmentDemosDir = resolve(process.cwd(), "apps/assessment-demos");
const workspaceRootDir = process.cwd();
const svelteKitTsconfigPath = resolve(
	assessmentDemosDir,
	".svelte-kit/tsconfig.json",
);

async function runCommand(cmd: string[], options: RunOptions = {}) {
	const proc = Bun.spawn(cmd, {
		cwd: options.cwd,
		stdio: ["inherit", "inherit", "inherit"],
		env: process.env,
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}

function removeDirIfExists(path: string) {
	if (!existsSync(path)) return;
	rmSync(path, { recursive: true, force: true });
}

const args = process.argv.slice(2);
const rebuildIndex = args.indexOf("--rebuild");
const shouldRebuild = rebuildIndex !== -1;

if (shouldRebuild) {
	args.splice(rebuildIndex, 1);
}

const hasHostArg = args.some((arg) => {
	if (arg === "--host") return true;
	if (arg.startsWith("--host=")) return true;
	return false;
});

if (shouldRebuild) {
	console.log("[dev:assessment] --rebuild enabled");
	console.log("[dev:assessment] Cleaning assessment demo caches...");

	removeDirIfExists(resolve(assessmentDemosDir, ".svelte-kit"));
	removeDirIfExists(resolve(assessmentDemosDir, ".vite"));
	removeDirIfExists(resolve(assessmentDemosDir, "node_modules/.vite"));
	removeDirIfExists(resolve(workspaceRootDir, "node_modules/.vite"));

	console.log("[dev:assessment] Rebuilding workspace packages...");
	await runCommand(["bun", "run", "build"]);

	if (!args.includes("--force")) {
		args.push("--force");
	}
}

if (!existsSync(svelteKitTsconfigPath)) {
	console.log("[dev:assessment] Syncing SvelteKit generated files...");
	await runCommand(["bun", "x", "svelte-kit", "sync"], {
		cwd: assessmentDemosDir,
	});
}

if (!hasHostArg) {
	args.push("--host", "127.0.0.1");
}

console.log("[dev:assessment] Starting assessment demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/assessment-demos", "dev", ...args]);
