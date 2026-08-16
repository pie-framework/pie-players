import { describe, expect, test } from "bun:test";

import { decideHookInstall } from "../lib/git-hook-install.mjs";

const ROOT = "/repo";
const COMMON = "/repo/.git";

describe("decideHookInstall", () => {
	test("installs in the main worktree, where git reports both dirs as .git", () => {
		const result = decideHookInstall({
			gitDir: ".git",
			gitCommonDir: ".git",
			cwd: ROOT,
		});

		expect(result.install).toBe(true);
		expect(result.reason).toContain("main worktree");
	});

	test("installs when git reports the main worktree's dirs absolutely", () => {
		const result = decideHookInstall({
			gitDir: COMMON,
			gitCommonDir: COMMON,
			cwd: ROOT,
		});

		expect(result.install).toBe(true);
	});

	test("skips in a linked worktree, whose git dir is under .git/worktrees", () => {
		const result = decideHookInstall({
			gitDir: `${COMMON}/worktrees/topic`,
			gitCommonDir: COMMON,
			cwd: "/repo-wt/topic",
		});

		expect(result.install).toBe(false);
		expect(result.reason).toContain("linked worktree");
	});

	test("skips in a worktree nested inside the main checkout", () => {
		const result = decideHookInstall({
			gitDir: `${COMMON}/worktrees/nested`,
			gitCommonDir: COMMON,
			cwd: `${ROOT}/.claude/worktrees/nested`,
		});

		expect(result.install).toBe(false);
		expect(result.reason).toContain("linked worktree");
	});

	test("skips when git is unavailable or this is not a checkout", () => {
		for (const input of [
			{ gitDir: null, gitCommonDir: null },
			{ gitDir: ".git", gitCommonDir: null },
			{ gitDir: null, gitCommonDir: ".git" },
		]) {
			const result = decideHookInstall({ ...input, cwd: ROOT });

			expect(result.install).toBe(false);
			expect(result.reason).toContain("not a git checkout");
		}
	});
});
