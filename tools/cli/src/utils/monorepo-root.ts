import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The nearest directory at or above `startDir` that holds this repository's
 * root `package.json` and `packages/item-player`.
 */
export function findMonorepoRoot(startDir: string): string | undefined {
	let dir = resolve(startDir);
	while (true) {
		const hasRootPackage = existsSync(join(dir, "package.json"));
		const hasItemPlayer = existsSync(
			join(dir, "packages", "item-player", "package.json"),
		);
		if (hasRootPackage && hasItemPlayer) return dir;
		const parent = dirname(dir);
		if (parent === dir) return undefined;
		dir = parent;
	}
}

/**
 * The pie-players repository root. A command never takes the process
 * directory as the root, because it runs from wherever it was started
 * (`bun --cwd tools/cli`, `./bin/run.js`, a CI step). It looks up from the
 * process directory, `GITHUB_WORKSPACE`, the directory of `fromPath`, the git
 * top level and this CLI's own location, in that order.
 */
export function resolveMonorepoDir(fromPath?: string): string {
	const cwd = process.cwd();
	const candidates: string[] = [cwd];
	if (process.env.GITHUB_WORKSPACE) {
		candidates.push(process.env.GITHUB_WORKSPACE);
	}
	if (fromPath) {
		candidates.push(resolve(cwd, dirname(fromPath)));
	}
	try {
		const gitRoot = execSync("git rev-parse --show-toplevel", {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString("utf8")
			.trim();
		if (gitRoot) candidates.push(gitRoot);
	} catch {
		// Not inside a git checkout.
	}
	candidates.push(dirname(fileURLToPath(import.meta.url)));

	for (const candidate of candidates) {
		const root = findMonorepoRoot(candidate);
		if (root) return root;
	}
	throw new Error(
		`Unable to resolve monorepo root from cwd=${cwd}${fromPath ? ` path=${fromPath}` : ""}`,
	);
}

/**
 * A path a user passed: as given when absolute, from the process directory
 * when it exists there, and from the repository root otherwise.
 */
export function resolveInputPath(path: string, monorepoDir: string): string {
	if (isAbsolute(path)) return path;
	const fromCwd = resolve(process.cwd(), path);
	return existsSync(fromCwd) ? fromCwd : resolve(monorepoDir, path);
}
