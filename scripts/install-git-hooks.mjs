#!/usr/bin/env node

/**
 * `prepare` lifecycle entry point: install the lefthook git hooks, unless this checkout
 * is a linked worktree.
 *
 * Replaces a bare `"prepare": "lefthook install"`, which ran in every checkout and let a
 * `bun install` from any worktree rewrite the hooks that all of them share. The decision
 * lives in scripts/lib/git-hook-install.mjs; this file is the git and process plumbing
 * around it. See that module for what a worktree install breaks.
 */

import { spawnSync } from "node:child_process";

import { decideHookInstall } from "./lib/git-hook-install.mjs";

const LABEL = "[install-git-hooks]";

/** A git path query, or null when git is unavailable or this is not a checkout. */
function gitPath(flag) {
	const result = spawnSync("git", ["rev-parse", flag], { encoding: "utf8" });
	if (result.status !== 0) {
		return null;
	}

	return result.stdout.trim() || null;
}

function main() {
	const { install, reason } = decideHookInstall({
		gitDir: gitPath("--git-dir"),
		gitCommonDir: gitPath("--git-common-dir"),
		cwd: process.cwd(),
	});

	if (!install) {
		console.log(`${LABEL} Skipping hook install: ${reason}.`);
		return 0;
	}

	// Bare `lefthook` on purpose: the lifecycle runner puts node_modules/.bin on PATH,
	// which is how the previous `"prepare": "lefthook install"` resolved it. Resolving the
	// binary by hand here would be a second copy of the fallback chain in .lefthookrc.
	const installed = spawnSync("lefthook", ["install"], { stdio: "inherit" });

	if (installed.error) {
		console.error(
			`${LABEL} Could not run lefthook install: ${installed.error.message}`,
		);
		return 1;
	}

	return installed.status ?? 1;
}

process.exit(main());
