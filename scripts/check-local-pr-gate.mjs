#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const requiredCiLintTypecheckCommands = [
	"check:local-pr-gate",
	"check:deps",
	"check:package-metadata",
	"check:svelte-runtime-deps",
	"check:custom-elements",
	"check:ce-define-safety",
	"check:speech-composition-purity",
	"check:scripts",
	"build",
	"check:player-tool-boundaries",
	"check:publint",
	"check:types-publish",
	"check:pack-integrity",
	"check:node-consumer-imports",
	"check:consumer-boundaries",
	"lint:all",
];

const requiredPrePushCommands = [
	"check:changeset-patch-only",
	"check:local-pr-gate",
];

const requiredLocalPrCommands = [
	"check:changeset-patch-only",
	"verify:ci-lint-typecheck",
	"test:e2e:section-player:critical",
	"test:e2e:item-player:critical",
	"test:e2e:assessment-player",
];

const requiredCiE2eCommands = [
	"test:e2e:section-player:critical",
	"test:e2e:item-player:critical",
	"test:e2e:assessment-player",
];

function collectMissingOrderedCommands({
	scripts,
	scriptName,
	required,
	failures,
}) {
	const script = scripts?.[scriptName];
	if (typeof script !== "string") {
		failures.push(`package.json is missing script "${scriptName}".`);
		return;
	}

	const commands = script
		.split("&&")
		.map((part) => part.trim())
		.filter(Boolean);
	let previousIndex = -1;
	for (const command of required) {
		const token = `bun run ${command}`;
		const index = commands.indexOf(token);
		if (index === -1) {
			failures.push(`${scriptName} is missing "${token}".`);
			continue;
		}
		if (index <= previousIndex) {
			failures.push(`${scriptName} runs "${token}" out of order.`);
		}
		previousIndex = index;
	}
}

export function collectGateFailures({ packageJson, lefthook, ciWorkflow }) {
	const failures = [];
	const scripts = packageJson.scripts;

	collectMissingOrderedCommands({
		scripts,
		scriptName: "verify:ci-lint-typecheck",
		required: requiredCiLintTypecheckCommands,
		failures,
	});

	collectMissingOrderedCommands({
		scripts,
		scriptName: "verify:pre-push",
		required: requiredPrePushCommands,
		failures,
	});

	collectMissingOrderedCommands({
		scripts,
		scriptName: "verify:local-pr",
		required: requiredLocalPrCommands,
		failures,
	});

	if (!lefthook.includes("run: bun run verify:pre-push")) {
		failures.push("lefthook pre-push must run bun run verify:pre-push.");
	}

	if (!ciWorkflow.includes("run: bun run verify:ci-lint-typecheck")) {
		failures.push(
			"CI Lint & Typecheck must run bun run verify:ci-lint-typecheck.",
		);
	}

	for (const command of requiredCiE2eCommands) {
		if (!ciWorkflow.includes(command)) {
			failures.push(`CI critical e2e matrix is missing "${command}".`);
		}
	}

	return failures;
}

function main() {
	const packageJsonPath = path.join(ROOT, "package.json");
	const lefthookPath = path.join(ROOT, "lefthook.yml");
	const ciWorkflowPath = path.join(ROOT, ".github", "workflows", "ci.yml");

	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	const lefthook = readFileSync(lefthookPath, "utf8");
	const ciWorkflow = readFileSync(ciWorkflowPath, "utf8");
	const failures = collectGateFailures({ packageJson, lefthook, ciWorkflow });

	if (failures.length > 0) {
		console.error("[check-local-pr-gate] Local PR gate is incomplete:");
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(
		"[check-local-pr-gate] OK: fast pre-push, full local PR, and CI gates are configured",
	);
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
