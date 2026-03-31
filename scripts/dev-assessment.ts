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
const requiredDistArtifacts = [
	"packages/assessment-player/dist/pie-assessment-player.js",
	"packages/assessment-toolkit/dist/index.js",
	"packages/players-shared/dist/index.js",
	"packages/section-player-tools-event-debugger/dist/section-player-tools-event-debugger.js",
	"packages/section-player-tools-instrumentation-debugger/dist/section-player-tools-instrumentation-debugger.js",
	"packages/section-player-tools-session-debugger/dist/section-player-tools-session-debugger.js",
	"packages/section-player-tools-shared/dist/index.js",
	"packages/tool-calculator-desmos/dist/pie-tool-calculator.js",
	"packages/tool-text-to-speech/dist/tool-text-to-speech.js",
	"packages/tts-server-google/dist/index.js",
	"packages/tts-server-polly/dist/index.js",
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

if (!shouldRebuild) {
	const missingArtifacts = getMissingDistArtifacts();
	if (missingArtifacts.length > 0) {
		console.error(
			"[dev:assessment] Missing package build artifacts required by assessment demos:",
		);
		for (const artifact of missingArtifacts) {
			console.error(`  - ${artifact}`);
		}
		console.error("");
		console.error("[dev:assessment] Run one of these commands, then try again:");
		console.error("  bun run dev:assessment -- --rebuild");
		console.error("  bun run build && bun run dev:assessment");
		process.exit(1);
	}
}

if (!hasHostArg) {
	args.push("--host", "127.0.0.1");
}

console.log("[dev:assessment] Starting assessment demo dev server...");
await runCommand(["bun", "run", "--cwd", "apps/assessment-demos", "dev", ...args]);
