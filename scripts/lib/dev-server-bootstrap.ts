import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

export interface DevServerBootstrapConfig {
	/** Used in `[dev:X]` log prefixes and `bun run dev:X` hint commands. */
	devScriptName: string;
	/** Human display label, e.g. "assessment", "section", "LTI", "item" — used in "Cleaning {label} demo caches..." etc. */
	label: string;
	/** Relative path (from the workspace root) to the app directory, e.g. "apps/section-demos". */
	appDir: string;
	/** Relative paths (from the workspace root) to dist artifacts required before the dev server can run. */
	requiredDistArtifacts: string[];
}

type RunOptions = {
	cwd?: string;
};

/**
 * Shared bootstrap for every `dev:*` demo-app script: optionally rebuild and
 * clear caches on `--rebuild`, sync SvelteKit's generated files if missing,
 * fail fast with a clear hint if a required package hasn't been built yet,
 * and default to a deterministic IPv4 host so localhost DNS resolution
 * can't bounce between `::1` and `127.0.0.1` across concurrent dev servers.
 */
export async function runDevServerBootstrap(
	config: DevServerBootstrapConfig,
): Promise<void> {
	const { devScriptName, label, appDir, requiredDistArtifacts } = config;
	const logPrefix = `[dev:${devScriptName}]`;
	const appDirAbs = resolve(process.cwd(), appDir);
	const workspaceRootDir = process.cwd();
	const svelteKitTsconfigPath = resolve(appDirAbs, ".svelte-kit/tsconfig.json");

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
		console.log(`${logPrefix} --rebuild enabled`);
		console.log(`${logPrefix} Cleaning ${label} demo caches...`);

		removeDirIfExists(resolve(appDirAbs, ".svelte-kit"));
		removeDirIfExists(resolve(appDirAbs, ".vite"));
		removeDirIfExists(resolve(appDirAbs, "node_modules/.vite"));
		removeDirIfExists(resolve(workspaceRootDir, "node_modules/.vite"));

		console.log(`${logPrefix} Rebuilding workspace packages...`);
		await runCommand(["bun", "run", "build"]);

		// Ensure Vite does a fresh dependency optimization pass after cache cleanup.
		if (!args.includes("--force")) {
			args.push("--force");
		}
	}

	if (!existsSync(svelteKitTsconfigPath)) {
		console.log(`${logPrefix} Syncing SvelteKit generated files...`);
		await runCommand(["bun", "x", "svelte-kit", "sync"], {
			cwd: appDirAbs,
		});
	}

	if (!shouldRebuild) {
		const missingArtifacts = getMissingDistArtifacts();
		if (missingArtifacts.length > 0) {
			console.error(
				`${logPrefix} Missing package build artifacts required by ${label} demos:`,
			);
			for (const artifact of missingArtifacts) {
				console.error(`  - ${artifact}`);
			}
			console.error("");
			console.error(`${logPrefix} Run one of these commands, then try again:`);
			console.error(`  bun run dev:${devScriptName} -- --rebuild`);
			console.error(`  bun run build && bun run dev:${devScriptName}`);
			process.exit(1);
		}
	}

	if (!hasHostArg) {
		args.push("--host", "127.0.0.1");
	}

	console.log(`${logPrefix} Starting ${label} demo dev server...`);
	await runCommand(["bun", "run", "--cwd", appDir, "dev", ...args]);
}
