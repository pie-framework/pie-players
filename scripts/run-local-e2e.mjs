#!/usr/bin/env node

/**
 * The local PR gate's Playwright stage: build every suite, then run the suites
 * concurrently.
 *
 * scripts/lib/local-e2e-suites.mjs lists the suites and splits each one into its
 * build and its `:prebuilt` run. Builds stream as they run. A suite's output is held
 * until it finishes and printed as one block, so concurrent output never interleaves.
 *
 * PIE_E2E_CONCURRENCY caps how many suites run at once; 1 runs them one at a time.
 * The default is half the available cores, at most one per suite: each suite holds a
 * dev server and a browser.
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";

import {
	LOCAL_GATE_E2E_SUITES,
	planLocalE2e,
} from "./lib/local-e2e-suites.mjs";

const LABEL = "[local-e2e]";

/** @returns {number | null} null when PIE_E2E_CONCURRENCY is not a positive integer */
function resolveConcurrency(suiteCount) {
	const requested = process.env.PIE_E2E_CONCURRENCY;
	if (requested !== undefined && requested !== "") {
		const value = Number(requested);
		return Number.isInteger(value) && value >= 1
			? Math.min(value, suiteCount)
			: null;
	}
	return Math.min(
		suiteCount,
		Math.max(1, Math.floor(availableParallelism() / 2)),
	);
}

function formatDuration(ms) {
	const seconds = Math.round(ms / 1000);
	return seconds < 60
		? `${seconds}s`
		: `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}

/**
 * Each suite runs in its own process group, so a signal reaches its dev server and
 * browser as well as `bun run`.
 */
const running = new Set();

function forwardSignal(signal) {
	for (const child of running) {
		try {
			process.kill(-child.pid, signal);
		} catch {
			// The group already exited.
		}
	}
	process.exit(signal === "SIGINT" ? 130 : 143);
}

function runSuite({ suite, script }, env) {
	return new Promise((resolve) => {
		const startedAt = Date.now();
		const child = spawn("bun", ["run", script], {
			env,
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		running.add(child);
		const chunks = [];
		child.stdout.on("data", (chunk) => chunks.push(chunk));
		child.stderr.on("data", (chunk) => chunks.push(chunk));
		child.on("error", (error) => {
			chunks.push(Buffer.from(`${error.message}\n`));
		});
		child.on("close", (code, signal) => {
			running.delete(child);
			resolve({
				suite,
				passed: code === 0,
				detail: signal ? `killed by ${signal}` : `exit ${code}`,
				duration: Date.now() - startedAt,
				output: Buffer.concat(chunks).toString("utf8"),
			});
		});
	});
}

function printResult(result) {
	const status = result.passed ? "passed" : `FAILED (${result.detail})`;
	console.log(
		`\n${LABEL} ── ${result.suite} ${status} in ${formatDuration(result.duration)} ──`,
	);
	process.stdout.write(result.output);
}

async function runConcurrently(runs, concurrency, env) {
	const queue = [...runs];
	const results = [];

	async function worker() {
		for (let next = queue.shift(); next; next = queue.shift()) {
			console.log(`${LABEL} started ${next.suite}`);
			const result = await runSuite(next, env);
			printResult(result);
			results.push(result);
		}
	}

	await Promise.all(Array.from({ length: concurrency }, worker));
	return results;
}

async function main() {
	const packageJson = JSON.parse(
		readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
	);
	const { builds, runs, failures } = planLocalE2e(
		packageJson.scripts,
		LOCAL_GATE_E2E_SUITES,
	);
	if (failures.length > 0) {
		for (const failure of failures) console.error(`${LABEL} ${failure}`);
		return 1;
	}
	const concurrency = resolveConcurrency(runs.length);
	if (concurrency === null) {
		console.error(
			`${LABEL} PIE_E2E_CONCURRENCY must be a positive integer, got "${process.env.PIE_E2E_CONCURRENCY}".`,
		);
		return 1;
	}

	for (const build of builds) {
		console.log(`${LABEL} bun run ${build}`);
		const result = spawnSync("bun", ["run", build], { stdio: "inherit" });
		if (result.status !== 0) {
			console.error(`${LABEL} ${build} failed; no suite ran.`);
			return result.status ?? 1;
		}
	}

	// Output is piped, so Playwright would drop its colors without this.
	const env =
		process.stdout.isTTY && !process.env.NO_COLOR
			? { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" }
			: process.env;

	process.on("SIGINT", () => forwardSignal("SIGINT"));
	process.on("SIGTERM", () => forwardSignal("SIGTERM"));

	console.log(
		`${LABEL} running ${runs.length} suites, ${concurrency} at a time (PIE_E2E_CONCURRENCY)`,
	);
	const startedAt = Date.now();
	const results = await runConcurrently(runs, concurrency, env);

	const failed = results.filter((result) => !result.passed);
	console.log(
		`\n${LABEL} ${results.length - failed.length}/${results.length} suites passed in ${formatDuration(Date.now() - startedAt)}`,
	);
	for (const result of failed) {
		console.error(`${LABEL} failed: ${result.suite} (${result.detail})`);
	}
	return failed.length === 0 ? 0 : 1;
}

process.exit(await main());
