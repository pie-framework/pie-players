#!/usr/bin/env bun

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

type RunOptions = {
	cwd?: string;
};

const sectionDemosDir = resolve(process.cwd(), "apps/section-demos");
const workspaceRootDir = process.cwd();
const svelteKitTsconfigPath = resolve(
	sectionDemosDir,
	".svelte-kit/tsconfig.json",
);
const requiredDistArtifacts = [
	"packages/tts-client-server/dist/index.js",
	"packages/calculator-desmos/dist/index.js",
	"packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
	"packages/tool-text-to-speech/dist/tool-text-to-speech.js",
	"packages/tool-answer-eliminator/dist/tool-answer-eliminator.js",
	"packages/tool-annotation-toolbar/dist/tool-annotation-toolbar.js",
	"packages/tool-color-scheme/dist/tool-color-scheme.js",
	"packages/tool-graph/dist/tool-graph.js",
	"packages/tool-periodic-table/dist/tool-periodic-table.js",
	"packages/tool-protractor/dist/tool-protractor.js",
	"packages/tool-line-reader/dist/tool-line-reader.js",
	"packages/tool-ruler/dist/tool-ruler.js",
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
	console.log("[dev:section] --rebuild enabled");
	console.log("[dev:section] Cleaning section demo caches...");

	removeDirIfExists(resolve(sectionDemosDir, ".svelte-kit"));
	removeDirIfExists(resolve(sectionDemosDir, ".vite"));
	removeDirIfExists(
		resolve(sectionDemosDir, "node_modules/.vite"),
	);
	removeDirIfExists(resolve(workspaceRootDir, "node_modules/.vite"));

	console.log("[dev:section] Rebuilding workspace packages...");
	await runCommand(["bun", "run", "build"]);

	// Ensure Vite does a fresh dependency optimization pass after cache cleanup.
	if (!args.includes("--force")) {
		args.push("--force");
	}
}

if (!existsSync(svelteKitTsconfigPath)) {
	console.log("[dev:section] Syncing SvelteKit generated files...");
	await runCommand(["bun", "x", "svelte-kit", "sync"], {
		cwd: sectionDemosDir,
	});
}

if (!shouldRebuild) {
	const missingArtifacts = getMissingDistArtifacts();
	if (missingArtifacts.length > 0) {
		console.error(
			"[dev:section] Missing package build artifacts required by section demos:",
		);
		for (const artifact of missingArtifacts) {
			console.error(`  - ${artifact}`);
		}
		console.error("");
		console.error("[dev:section] Run one of these commands, then try again:");
		console.error("  bun run dev:section -- --rebuild");
		console.error("  bun run build && bun run dev:section");
		process.exit(1);
	}
}

if (!hasHostArg) {
	// Force deterministic IPv4 host so localhost DNS resolution cannot bounce
	// between ::1 and 127.0.0.1 across concurrent dev servers.
	args.push("--host", "127.0.0.1");
}

console.log("[dev:section] Starting section demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/section-demos", "dev", ...args]);
