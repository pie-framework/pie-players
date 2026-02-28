#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

const itemDemosDir = resolve(process.cwd(), "apps/item-demos");
const svelteKitTsconfigPath = resolve(itemDemosDir, ".svelte-kit/tsconfig.json");

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
	console.log("[dev:item] --rebuild enabled");
	console.log("[dev:item] Cleaning item demo caches...");

	removeDirIfExists(resolve(itemDemosDir, ".svelte-kit"));
	removeDirIfExists(resolve(itemDemosDir, "node_modules/.vite"));

	console.log("[dev:item] Rebuilding workspace packages...");
	await runCommand(["bun", "run", "build"]);
}

if (!existsSync(svelteKitTsconfigPath)) {
	console.log("[dev:item] Syncing SvelteKit generated files...");
	await runCommand(["bun", "x", "svelte-kit", "sync"], {
		cwd: itemDemosDir,
	});
}

console.log("[dev:item] Starting item demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/item-demos", "dev", ...args]);
