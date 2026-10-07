import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");

/** The native binary of the installed lefthook, resolved the way its npm wrapper does. */
const LEFTHOOK = createRequire(import.meta.url)(
	path.join(ROOT, "node_modules", "lefthook", "get-exe.js"),
).getExePath();

const tempDirs = [];
afterEach(() => {
	for (const dir of tempDirs.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

/**
 * A repository with a pre-commit hook that records the `a.txt` it sees, and a linked
 * worktree of it, as `.claude/worktrees/` holds. Git and lefthook see none of the
 * caller's environment: this suite runs inside the git hooks, where git exports
 * variables that would point these commands at the outer repository.
 */
function createWorktree() {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-pre-commit-hook-"));
	tempDirs.push(dir);
	const main = path.join(dir, "main");
	const worktree = path.join(dir, "worktree");
	const seen = path.join(dir, "seen-by-hook.txt");
	const gitConfig = path.join(dir, "gitconfig");
	writeFileSync(
		gitConfig,
		"[user]\n\tname = test\n\temail = test@example.com\n[commit]\n\tgpgsign = false\n[init]\n\tdefaultBranch = develop\n",
	);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([key]) => !key.startsWith("GIT_") && !key.startsWith("LEFTHOOK"),
		),
	);
	Object.assign(env, {
		GIT_CONFIG_GLOBAL: gitConfig,
		GIT_CONFIG_NOSYSTEM: "1",
		LEFTHOOK_BIN: LEFTHOOK,
	});

	const run = (command, args, cwd) =>
		spawnSync(command, args, { cwd, env, encoding: "utf8" });
	const must = (command, args, cwd = main) => {
		const result = run(command, args, cwd);
		if (result.status !== 0) {
			throw new Error(
				`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
			);
		}
		return result;
	};

	must("git", ["init", "--quiet", main], dir);
	writeFileSync(
		path.join(main, "lefthook.yml"),
		`pre-commit:\n  commands:\n    record:\n      run: cp a.txt '${seen}'\n`,
	);
	writeFileSync(path.join(main, "a.txt"), "base\n");
	must("git", ["add", "--all"]);
	must("git", ["commit", "--quiet", "--no-verify", "--message", "init"]);
	must(LEFTHOOK, ["install"]);
	must("git", ["worktree", "add", "--quiet", "-b", "topic", worktree]);

	return {
		file: path.join(worktree, "a.txt"),
		git: (...args) => run("git", args, worktree),
		seenByHook: () => readFileSync(seen, "utf8"),
	};
}

describe("the pre-commit hook in a linked worktree", () => {
	// lefthook 2.1.16 and 2.1.17 save the unstaged changes with
	// `git diff --output <main checkout>/.git/info/<patch> --`, which git reads as a
	// --no-index diff of two paths outside the worktree, so the commit fails
	// (evilmartians/lefthook#1580).
	test("commits a partially staged file and keeps its unstaged change out of the hook and the commit", () => {
		const repo = createWorktree();
		appendFileSync(repo.file, "staged\n");
		repo.git("add", "a.txt");
		appendFileSync(repo.file, "unstaged\n");

		const result = repo.git("commit", "--quiet", "--message", "partial");

		const output = result.stderr + result.stdout;
		expect(output.match(/Failed to save unstaged changes[^\n]*/)?.[0]).toBe(
			undefined,
		);
		expect(result.status).toBe(0);
		expect(repo.seenByHook()).toBe("base\nstaged\n");
		expect(repo.git("show", "HEAD:a.txt").stdout).toBe("base\nstaged\n");
		expect(readFileSync(repo.file, "utf8")).toBe("base\nstaged\nunstaged\n");
	}, 30_000);
});
