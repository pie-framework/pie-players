#!/usr/bin/env node

/**
 * `prepare` lifecycle entry point: run `svelte-kit sync` in every SvelteKit workspace app
 * so the `.svelte-kit/tsconfig.json` each one's `tsconfig.json` extends exists on disk.
 *
 * Every SvelteKit app here extends `./.svelte-kit/tsconfig.json`, which is generated
 * rather than committed. Vite 8.0 tolerated the dangling `extends` and only the app's own
 * tooling needed the file, which is why each app's `check` script already runs a sync of
 * its own. Vite 8.2 (rolldown) resolves tsconfigs across the workspace and throws
 * `Tsconfig not found <app>/.svelte-kit/tsconfig.json`, so on a fresh checkout an
 * unrelated package's build fails on a file none of its own sources reference.
 *
 * This runs at `prepare` rather than inside the build scripts because the build entry
 * points are plural: `bun run build` is one, and each `build:e2e:*` script invokes
 * `turbo build --filter=...` directly. Generating the files once per install covers all of
 * them, and CI installs before it builds.
 *
 * A sync failure is not fatal. The generated files are a build input, not a product, and a
 * partially-installed checkout should not be blocked from installing; the build reports a
 * missing tsconfig clearly enough on its own.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LABEL = "[sync-svelte-kit]";
const WORKSPACE_ROOTS = ["apps", "packages", "tools"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

/** Workspace directories that depend on @sveltejs/kit and so have a sync to run. */
function discoverSvelteKitProjects() {
	const projects = [];

	for (const root of WORKSPACE_ROOTS) {
		const rootDir = join(process.cwd(), root);
		if (!existsSync(rootDir)) continue;

		for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;

			const dir = join(rootDir, entry.name);
			const manifestPath = join(dir, "package.json");
			if (!existsSync(manifestPath)) continue;

			let manifest;
			try {
				manifest = readJson(manifestPath);
			} catch {
				continue;
			}

			const dependsOnKit = [
				manifest.dependencies,
				manifest.devDependencies,
				manifest.peerDependencies,
			].some((section) => section?.["@sveltejs/kit"]);

			if (dependsOnKit) {
				projects.push(`${root}/${entry.name}`);
			}
		}
	}

	return projects.sort((a, b) => a.localeCompare(b));
}

function main() {
	const projects = discoverSvelteKitProjects();

	if (projects.length === 0) {
		console.log(`${LABEL} No SvelteKit projects found; nothing to sync.`);
		return 0;
	}

	const failed = [];

	for (const project of projects) {
		// Bare `svelte-kit`: the lifecycle runner puts node_modules/.bin on PATH, the same
		// way each app's own `check` script resolves it.
		const result = spawnSync("svelte-kit", ["sync"], {
			cwd: join(process.cwd(), project),
			stdio: "ignore",
		});

		if (result.error || result.status !== 0) {
			failed.push(project);
		}
	}

	if (failed.length > 0) {
		console.warn(
			`${LABEL} Synced ${projects.length - failed.length}/${projects.length} project(s); could not sync: ${failed.join(", ")}.`,
		);
		return 0;
	}

	console.log(`${LABEL} OK: synced ${projects.length} SvelteKit project(s).`);
	return 0;
}

process.exit(main());
