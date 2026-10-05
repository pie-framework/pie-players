#!/usr/bin/env node

/**
 * pre-push hook entry point: run the full local gate, unless the push carries no new
 * commits, or only the documentation checks when its new commits change documentation only.
 *
 * Wired from lefthook.yml with `use_stdin: true`, which is what makes this possible —
 * lefthook only forwards git's ref lines to a command that asks for them. The decision
 * itself lives in scripts/lib/push-scope.mjs; this file is the git and process plumbing
 * around it. See that module for why every uncertain case still runs the gate.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { classifyPush, ZERO_SHA } from "./lib/push-scope.mjs";

const LABEL = "[pre-push-gate]";

/**
 * The revisions this ref update would add to the remote.
 *
 * A brand-new remote ref has no "before" to diff against, so the question becomes whether
 * the commits are reachable from any remote-tracking ref we already have. That reads local
 * remote-tracking refs, which can be stale — and stale refs make already-pushed commits
 * look new, which errs toward running the gate.
 */
function newCommitRange({ localSha, remoteSha }) {
	return remoteSha === ZERO_SHA || /^0+$/.test(remoteSha)
		? [localSha, "--not", "--remotes"]
		: [`${remoteSha}..${localSha}`];
}

function countNewCommits(refUpdate) {
	const args = ["rev-list", "--count", ...newCommitRange(refUpdate)];

	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) {
		return null;
	}

	const count = Number.parseInt(result.stdout.trim(), 10);
	return Number.isNaN(count) ? null : count;
}

/**
 * Every path the new commits touch, each commit on its own: a file changed and changed back
 * still counts. `-m` lists a merge commit's paths against each parent, so a merge brings in
 * the merged branch's paths; `--no-renames` lists both sides of a rename.
 */
function listChangedPaths(refUpdate) {
	const args = [
		"log",
		"-m",
		"--name-only",
		"--no-renames",
		"--format=",
		...newCommitRange(refUpdate),
	];

	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) {
		return null;
	}

	return result.stdout.split("\n").filter(Boolean);
}

function readHookStdin() {
	// A TTY means there is no hook payload to read and reading fd 0 would block forever.
	if (process.stdin.isTTY) {
		return null;
	}

	try {
		return readFileSync(0, "utf8");
	} catch {
		return null;
	}
}

function main() {
	const { verdict, reason } = classifyPush({
		stdin: readHookStdin(),
		countNewCommits,
		listChangedPaths,
	});

	if (verdict === "skip") {
		console.log(`${LABEL} Skipping the local gate: ${reason}.`);
		return 0;
	}

	const script = verdict === "docs" ? "check:docs" : "verify:pre-push";
	console.log(
		verdict === "docs"
			? `${LABEL} Running the documentation checks only: ${reason}.`
			: `${LABEL} Running the local gate: ${reason}.`,
	);
	const gate = spawnSync("bun", ["run", script], {
		stdio: "inherit",
	});

	if (gate.error) {
		console.error(
			`${LABEL} Could not start the local gate: ${gate.error.message}`,
		);
		return 1;
	}

	return gate.status ?? 1;
}

process.exit(main());
