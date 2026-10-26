import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { playwrightImage } from "../lib/playwright-ci.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const locked = (version) => ({ packages: Object.fromEntries(
	["@playwright/test", "playwright", "playwright-core"].map((name) => [name, [`${name}@${version}`]]),
) });

describe("Playwright CI environment", () => {
	test("follows the resolved version when the lock changes", () => {
		expect(playwrightImage(locked("1.64.1"))).toBe("mcr.microsoft.com/playwright:v1.64.1-noble");
		expect(playwrightImage(locked("1.65.0"))).toBe("mcr.microsoft.com/playwright:v1.65.0-noble");
	});

	test("rejects missing or mismatched browser revisions", () => {
		expect(() => playwrightImage({})).toThrow("released @playwright/test");
		const lock = locked("1.64.1");
		lock.packages["playwright-core"] = ["playwright-core@1.63.0"];
		expect(() => playwrightImage(lock)).toThrow("playwright-core to match");
	});

	test("lightweight runs publish no container image", () => {
		const fixture = mkdtempSync(path.join(tmpdir(), "pie-ci-image-"));
		try {
			const output = path.join(fixture, "outputs");
			const result = spawnSync(process.execPath, ["scripts/ci-change-scope.mjs"], {
				cwd: root,
				env: { ...process.env, GITHUB_EVENT_NAME: "push", SKIP_HEAVY: "true", GITHUB_OUTPUT: output },
				encoding: "utf8",
			});
			expect(result.status, result.stderr).toBe(0);
			expect(readFileSync(output, "utf8")).toContain("playwright_image=\n");
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	});
});

describe("sharded required checks", () => {
	const workflow = Bun.YAML.parse(readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"));
	for (const [jobId, requiredName] of [
		["item-player-e2e", "Critical E2E (item-player-critical)"],
		["section-player-e2e", "Critical E2E (section-player)"],
	]) {
		test(`${requiredName} requires every shard to succeed`, () => {
			const shards = workflow.jobs[jobId].strategy.matrix.shard;
			expect(shards.length).toBeGreaterThan(1);
			expect(shards).toEqual(Array.from({ length: shards.length }, (_, index) => index + 1));
			const result = workflow.jobs[`${jobId}-result`];
			expect(result.name).toBe(requiredName);
			expect(result.needs).toBe(jobId);
			expect(result.if).toBe("${{ always() }}");
			for (const status of ["success", "failure", "cancelled", "skipped"]) {
				const command = result.steps[0].run.replace(`\${{ needs.${jobId}.result }}`, status);
				const execution = spawnSync("sh", ["-c", command]);
				expect(execution.status === 0).toBe(status === "success");
			}
		});
	}
});
