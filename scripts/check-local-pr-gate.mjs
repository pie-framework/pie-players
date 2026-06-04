#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const packageJsonPath = path.join(ROOT, "package.json");
const lefthookPath = path.join(ROOT, "lefthook.yml");
const ciWorkflowPath = path.join(ROOT, ".github", "workflows", "ci.yml");

const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const lefthook = readFileSync(lefthookPath, "utf8");
const ciWorkflow = readFileSync(ciWorkflowPath, "utf8");

const script = pkg.scripts?.["verify:ci-lint-typecheck"];
const requiredCommands = [
	"check:local-pr-gate",
	"check:deps",
	"check:package-metadata",
	"check:svelte-runtime-deps",
	"check:custom-elements",
	"check:ce-define-safety",
	"check:speech-composition-purity",
	"check:scripts",
	"build",
	"check:publint",
	"check:types-publish",
	"check:pack-integrity",
	"check:node-consumer-imports",
	"check:consumer-boundaries",
	"lint:all",
];

const failures = [];

if (typeof script !== "string") {
	failures.push('package.json is missing script "verify:ci-lint-typecheck".');
} else {
	const commands = script
		.split("&&")
		.map((part) => part.trim())
		.filter(Boolean);
	let previousIndex = -1;
	for (const command of requiredCommands) {
		const token = `bun run ${command}`;
		const index = commands.indexOf(token);
		if (index === -1) {
			failures.push(`verify:ci-lint-typecheck is missing "${token}".`);
			continue;
		}
		if (index <= previousIndex) {
			failures.push(
				`verify:ci-lint-typecheck runs "${token}" out of CI order.`,
			);
		}
		previousIndex = index;
	}
}

if (!lefthook.includes("run: bun run verify:ci-lint-typecheck")) {
	failures.push("lefthook pre-push must run bun run verify:ci-lint-typecheck.");
}

if (!ciWorkflow.includes("run: bun run verify:ci-lint-typecheck")) {
	failures.push(
		"CI Lint & Typecheck must run bun run verify:ci-lint-typecheck.",
	);
}

if (failures.length > 0) {
	console.error("[check-local-pr-gate] Local PR gate is incomplete:");
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log(
	"[check-local-pr-gate] OK: pre-push mirrors CI lint/typecheck gate",
);
