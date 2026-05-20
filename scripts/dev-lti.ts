#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

const ltiDemosDir = resolve(process.cwd(), "apps/lti-demos");
const workspaceRootDir = process.cwd();
const svelteKitTsconfigPath = resolve(ltiDemosDir, ".svelte-kit/tsconfig.json");
const requiredDistArtifacts = [
	"packages/assessment-player/dist/pie-assessment-player.js",
	"packages/assessment-toolkit/dist/index.js",
	"packages/players-shared/dist/index.js",
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

const hasHostArg = args.some((arg) => {
	if (arg === "--host") return true;
	if (arg.startsWith("--host=")) return true;
	return false;
});

if (shouldRebuild) {
	console.log("[dev:lti] --rebuild enabled");
	console.log("[dev:lti] Cleaning LTI demo caches...");

	removeDirIfExists(resolve(ltiDemosDir, ".svelte-kit"));
	removeDirIfExists(resolve(ltiDemosDir, ".vite"));
	removeDirIfExists(resolve(ltiDemosDir, "node_modules/.vite"));
	removeDirIfExists(resolve(workspaceRootDir, "node_modules/.vite"));

	console.log("[dev:lti] Rebuilding workspace packages...");
	await runCommand(["bun", "run", "build"]);

	if (!args.includes("--force")) {
		args.push("--force");
	}
}

if (!existsSync(svelteKitTsconfigPath)) {
	console.log("[dev:lti] Syncing SvelteKit generated files...");
	await runCommand(["bun", "x", "svelte-kit", "sync"], {
		cwd: ltiDemosDir,
	});
}

if (!shouldRebuild) {
	const missingArtifacts = getMissingDistArtifacts();
	if (missingArtifacts.length > 0) {
		console.error("[dev:lti] Missing package build artifacts required by LTI demos:");
		for (const artifact of missingArtifacts) {
			console.error(`  - ${artifact}`);
		}
		console.error("");
		console.error("[dev:lti] Run one of these commands, then try again:");
		console.error("  bun run dev:lti -- --rebuild");
		console.error("  bun run build && bun run dev:lti");
		process.exit(1);
	}
}

if (!hasHostArg) {
	args.push("--host", "127.0.0.1");
}

console.log("[dev:lti] Starting LTI demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/lti-demos", "dev", ...args]);
