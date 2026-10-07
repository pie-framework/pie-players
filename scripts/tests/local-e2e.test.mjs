import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	LOCAL_GATE_E2E_SUITES,
	planLocalE2e,
} from "../lib/local-e2e-suites.mjs";

const RUNNER = path.resolve(import.meta.dir, "..", "run-local-e2e.mjs");

const tempDirs = [];
afterEach(() => {
	for (const dir of tempDirs.splice(0))
		rmSync(dir, { recursive: true, force: true });
});

/** A workspace whose suites run `runs[suite]` (default: a one-second sleep). */
function createWorkspace({ runs = {}, build = "echo built" } = {}) {
	const dir = mkdtempSync(path.join(tmpdir(), "pie-local-e2e-"));
	tempDirs.push(dir);
	const scripts = { "build:e2e:shared": build };
	for (const suite of LOCAL_GATE_E2E_SUITES) {
		scripts[`test:e2e:${suite}`] =
			`bun run build:e2e:shared && bun run test:e2e:${suite}:prebuilt`;
		scripts[`test:e2e:${suite}:prebuilt`] =
			runs[suite] ?? `sleep 1 && echo ran-${suite}`;
	}
	writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts }));
	return dir;
}

function runGate(cwd, env = {}) {
	const startedAt = Date.now();
	const result = spawnSync("bun", [RUNNER], {
		cwd,
		encoding: "utf8",
		env: { ...process.env, NO_COLOR: "1", ...env },
	});
	return {
		status: result.status,
		output: `${result.stdout}${result.stderr}`,
		elapsed: Date.now() - startedAt,
	};
}

describe("planLocalE2e", () => {
	test("splits each suite into its build and its prebuilt run, each build once", () => {
		const plan = planLocalE2e(
			{
				"test:e2e:a": "bun run build:e2e:x && bun run test:e2e:a:prebuilt",
				"test:e2e:a:prebuilt": "bunx playwright test",
				"test:e2e:b": "bun run build:e2e:y && bun run test:e2e:b:prebuilt",
				"test:e2e:b:prebuilt": "bunx playwright test",
				"test:e2e:c": "bun run build:e2e:x && bun run test:e2e:c:prebuilt",
				"test:e2e:c:prebuilt": "bunx playwright test",
			},
			["a", "b", "c"],
		);

		expect(plan).toEqual({
			builds: ["build:e2e:x", "build:e2e:y"],
			runs: [
				{ suite: "a", script: "test:e2e:a:prebuilt" },
				{ suite: "b", script: "test:e2e:b:prebuilt" },
				{ suite: "c", script: "test:e2e:c:prebuilt" },
			],
			failures: [],
		});
	});

	test("reports a suite without its script or its prebuilt run", () => {
		const { failures } = planLocalE2e(
			{ "test:e2e:b": "bun run build:e2e:y && bun run test:e2e:b:prebuilt" },
			["a", "b"],
		);

		expect(failures).toEqual([
			'package.json is missing script "test:e2e:a".',
			'package.json is missing script "test:e2e:b:prebuilt".',
		]);
	});

	test("rejects a suite with a step the split would drop", () => {
		const { failures } = planLocalE2e(
			{
				"test:e2e:a":
					"bun run build:e2e:x && bun run seed && bun run test:e2e:a:prebuilt",
				"test:e2e:a:prebuilt": "bunx playwright test",
			},
			["a"],
		);

		expect(failures).toHaveLength(1);
		expect(failures[0]).toStartWith("test:e2e:a must be");
	});
});

describe("run-local-e2e", () => {
	test("runs the suites concurrently after building once", () => {
		const result = runGate(createWorkspace(), {
			PIE_E2E_CONCURRENCY: String(LOCAL_GATE_E2E_SUITES.length),
		});

		expect(result.status).toBe(0);
		expect(result.output.match(/^built$/gm)).toHaveLength(1);
		for (const suite of LOCAL_GATE_E2E_SUITES) {
			expect(result.output).toContain(`ran-${suite}`);
		}
		expect(result.output).toContain(
			`${LOCAL_GATE_E2E_SUITES.length}/${LOCAL_GATE_E2E_SUITES.length} suites passed`,
		);
		// Five one-second suites, serially, take five seconds.
		expect(result.elapsed).toBeLessThan(4000);
	});

	test("runs every suite when one fails, and fails with its output", () => {
		const result = runGate(
			createWorkspace({
				runs: { "assessment-player": "echo assessment-broke && exit 3" },
			}),
		);

		expect(result.status).toBe(1);
		expect(result.output).toContain("assessment-player FAILED (exit 3)");
		expect(result.output).toContain("assessment-broke");
		expect(result.output).toContain("ran-item-player:critical");
		expect(result.output).toContain("failed: assessment-player (exit 3)");
	});

	test("runs no suite when a build fails", () => {
		const result = runGate(createWorkspace({ build: "exit 2" }));

		expect(result.status).toBe(2);
		expect(result.output).toContain("build:e2e:shared failed; no suite ran.");
		expect(result.output).not.toContain("ran-");
	});

	test("rejects a concurrency that is not a positive integer", () => {
		const result = runGate(createWorkspace(), { PIE_E2E_CONCURRENCY: "0" });

		expect(result.status).toBe(1);
		expect(result.output).toContain("PIE_E2E_CONCURRENCY must be a positive");
		expect(result.output).not.toContain("built");
	});
});
