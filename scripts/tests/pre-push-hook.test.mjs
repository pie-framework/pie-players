import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..", "..");
const ZERO_SHA = "0".repeat(40);

/** The native binary of the installed lefthook, resolved the way its npm wrapper does. */
const LEFTHOOK = createRequire(import.meta.url)(
	path.join(ROOT, "node_modules", "lefthook", "get-exe.js"),
).getExePath();

/** lefthook.yml's pre-push job as a `run:` command, the shape it replaced. */
const COMMAND_CONFIG = `pre-push:
  commands:
    fast-local-gate:
      use_stdin: true
      run: sh .lefthook/pre-push/pre-push-gate.sh
`;

const tempDirs = [];
afterEach(() => {
	for (const dir of tempDirs.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

/**
 * A repository pushing to a local bare remote through `lefthookConfig`, with the gate
 * script replaced by a stub that logs the ref lines of each run. Git and lefthook see
 * none of the caller's environment: this suite runs inside the pre-push gate, where git
 * exports variables that would point these commands at the outer repository.
 */
function createRepo(lefthookConfig) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-pre-push-hook-"));
	tempDirs.push(dir);
	const work = path.join(dir, "work");
	const runLog = path.join(dir, "gate-runs.log");
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

	const run = (command, args, cwd = work) => {
		const result = spawnSync(command, args, { cwd, env, encoding: "utf8" });
		if (result.status !== 0) {
			throw new Error(
				`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
			);
		}
		return result;
	};
	const git = (...args) => run("git", args);
	const commit = (...args) => git("commit", "--no-verify", "--quiet", ...args);

	run("git", ["init", "--quiet", "--bare", path.join(dir, "remote.git")], dir);
	run("git", ["init", "--quiet", work], dir);
	git("remote", "add", "origin", "../remote.git");
	writeFileSync(path.join(work, "lefthook.yml"), lefthookConfig);
	const script = path.join(work, ".lefthook", "pre-push", "pre-push-gate.sh");
	mkdirSync(path.dirname(script), { recursive: true });
	writeFileSync(
		script,
		`#!/bin/sh\n{ printf 'run:'; tr '\\n' ' '; echo; } >> '${runLog}'\n`,
	);
	chmodSync(script, 0o755);
	writeFileSync(path.join(work, "kept.txt"), "kept\n");
	writeFileSync(path.join(work, "deleted.txt"), "deleted\n");
	git("add", "--all");
	commit("--message", "init");
	run(LEFTHOOK, ["install"]);
	git("push", "--quiet", "--set-upstream", "origin", "develop");
	// As a clone has. For a branch with no upstream, lefthook diffs against the branch
	// origin/HEAD names; without one it lists every file in HEAD and never skips.
	git("remote", "set-head", "origin", "develop");

	return {
		git,
		commit,
		/** The ref lines each gate run received, oldest first. */
		gateRuns: () =>
			existsSync(runLog) ? readFileSync(runLog, "utf8").trim().split("\n") : [],
	};
}

/** A new branch whose one commit only deletes a file, pushed without an upstream. */
function pushDeletionOnlyBranch(repo) {
	repo.git("switch", "--quiet", "--create", "topic");
	repo.git("rm", "--quiet", "deleted.txt");
	repo.commit("--message", "delete a file");
	repo.git("push", "--quiet", "--set-upstream", "origin", "topic");
}

describe("the pre-push hook as lefthook.yml configures it", () => {
	const config = readFileSync(path.join(ROOT, "lefthook.yml"), "utf8");

	test("runs the gate for a new branch whose only commit deletes a file", () => {
		const repo = createRepo(config);
		pushDeletionOnlyBranch(repo);

		const runs = repo.gateRuns();
		expect(runs).toHaveLength(2);
		expect(runs[1]).toContain(`refs/heads/topic ${ZERO_SHA}`);
	}, 30_000);

	test("runs the gate for an empty commit on a branch with an upstream", () => {
		const repo = createRepo(config);
		repo.commit("--allow-empty", "--message", "empty");
		repo.git("push", "--quiet");

		expect(repo.gateRuns()).toHaveLength(2);
	}, 30_000);

	test("control: lefthook skips the same push when the gate is a `run:` command", () => {
		const repo = createRepo(COMMAND_CONFIG);
		pushDeletionOnlyBranch(repo);

		// Only the initial push, which adds files, ran it. If lefthook stops skipping
		// here, the script job in lefthook.yml is no longer needed.
		expect(repo.gateRuns()).toHaveLength(1);
	}, 30_000);
});
