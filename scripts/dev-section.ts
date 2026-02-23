#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

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

if (shouldRebuild) {
	console.log("[dev:section] --rebuild enabled");
	console.log("[dev:section] Cleaning section demo caches...");

	removeDirIfExists(resolve(process.cwd(), "apps/section-demos/.svelte-kit"));
	removeDirIfExists(
		resolve(process.cwd(), "apps/section-demos/node_modules/.vite"),
	);

	console.log("[dev:section] Rebuilding workspace packages...");
	await runCommand(["bun", "run", "build"]);
}

console.log("[dev:section] Starting section demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/section-demos", "dev", ...args]);
