#!/usr/bin/env node

/**
 * pre-push hook entry point: run the full local gate, unless the push carries no new
 * commits.
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
 * How many commits this ref update would add to the remote.
 *
 * A brand-new remote ref has no "before" to diff against, so the question becomes whether
 * the commits are reachable from any remote-tracking ref we already have. That reads local
 * remote-tracking refs, which can be stale — and stale refs make already-pushed commits
 * look new, which errs toward running the gate.
 */
function countNewCommits({ localSha, remoteSha }) {
	const args =
		remoteSha === ZERO_SHA || /^0+$/.test(remoteSha)
			? ["rev-list", "--count", localSha, "--not", "--remotes"]
			: ["rev-list", "--count", `${remoteSha}..${localSha}`];

	const result = spawnSync("git", args, { encoding: "utf8" });
	if (result.status !== 0) {
		return null;
	}

	const count = Number.parseInt(result.stdout.trim(), 10);
	return Number.isNaN(count) ? null : count;
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
	});

	if (verdict === "skip") {
		console.log(`${LABEL} Skipping the local gate: ${reason}.`);
		return 0;
	}

	console.log(`${LABEL} Running the local gate: ${reason}.`);
	const gate = spawnSync("bun", ["run", "verify:pre-push"], {
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
