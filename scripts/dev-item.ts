#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

const itemDemosDir = resolve(process.cwd(), "apps/item-demos");
const workspaceRootDir = process.cwd();
const svelteKitTsconfigPath = resolve(itemDemosDir, ".svelte-kit/tsconfig.json");
const requiredDistArtifacts = [
	"packages/item-player/dist/pie-item-player.js",
	"packages/players-shared/dist/index.js",
	"packages/section-player-tools-instrumentation-debugger/dist/section-player-tools-instrumentation-debugger.js",
];

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

function getMissingDistArtifacts() {
	return requiredDistArtifacts.filter((relativePath) => {
		return !existsSync(resolve(workspaceRootDir, relativePath));
	});
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

if (!shouldRebuild) {
	const missingArtifacts = getMissingDistArtifacts();
	if (missingArtifacts.length > 0) {
		console.error(
			"[dev:item] Missing package build artifacts required by item demos:",
		);
		for (const artifact of missingArtifacts) {
			console.error(`  - ${artifact}`);
		}
		console.error("");
		console.error("[dev:item] Run one of these commands, then try again:");
		console.error("  bun run dev:item -- --rebuild");
		console.error("  bun run build && bun run dev:item");
		process.exit(1);
	}
}

console.log("[dev:item] Starting item demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/item-demos", "dev", ...args]);
