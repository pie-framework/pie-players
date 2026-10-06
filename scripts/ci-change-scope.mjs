#!/usr/bin/env node

/**
 * CI's `Change Scope` job: decides which jobs this run skips and writes the decision to
 * $GITHUB_OUTPUT. The decision lives in scripts/lib/change-scope.mjs; this file reads the
 * event and the diff.
 *
 * A pull request checks out its merge commit, whose first parent is the base branch tip, so
 * `HEAD^1..HEAD` is the pull request's change. `--no-renames` lists both sides of a rename,
 * so code moved under `docs/` still counts as a code change.
 */

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import { ciScope } from "./lib/change-scope.mjs";

const LABEL = "[ci-change-scope]";

function listChangedPaths() {
	const result = spawnSync(
		"git",
		["diff", "--name-only", "--no-renames", "HEAD^1", "HEAD"],
		{ encoding: "utf8" },
	);
	if (result.status !== 0) {
		console.log(
			`${LABEL} Could not list the changed paths: ${result.stderr.trim()}`,
		);
		return null;
	}
	return result.stdout.split("\n").filter(Boolean);
}

const eventName = process.env.GITHUB_EVENT_NAME ?? "";
const changedPaths = eventName === "pull_request" ? listChangedPaths() : null;
const scope = ciScope({
	eventName,
	skipHeavy: process.env.SKIP_HEAVY === "true",
	changedPaths,
});

if (changedPaths !== null) {
	console.log(`${LABEL} ${changedPaths.length} changed path(s):`);
	for (const path of changedPaths) console.log(`  ${path}`);
}

const outputs = {
	skip_code: scope.skipCode,
	skip_docs: scope.skipDocs,
	skip_audit: scope.skipAudit,
	skip_cortex: scope.skipCortex,
};
const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
for (const line of lines) console.log(`${LABEL} ${line}`);

if (process.env.GITHUB_OUTPUT) {
	appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}
