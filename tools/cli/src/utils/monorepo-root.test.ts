import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
	findMonorepoRoot,
	resolveInputPath,
	resolveMonorepoDir,
} from "./monorepo-root.js";

const REPO_ROOT = fileURLToPath(
	new URL("../../../..", import.meta.url),
).replace(/\/$/, "");
const CLI_DIR = join(REPO_ROOT, "tools", "cli");

describe("monorepo root", () => {
	const originalCwd = process.cwd();
	const originalWorkspace = process.env.GITHUB_WORKSPACE;
	let outside: string;

	beforeEach(() => {
		outside = mkdtempSync(join(tmpdir(), "pie-cli-root-"));
		// CI sets it to the checkout, which would find the root on its own.
		delete process.env.GITHUB_WORKSPACE;
	});

	afterEach(() => {
		process.chdir(originalCwd);
		if (originalWorkspace === undefined) delete process.env.GITHUB_WORKSPACE;
		else process.env.GITHUB_WORKSPACE = originalWorkspace;
		rmSync(outside, { recursive: true, force: true });
	});

	test("finds the root from a directory inside the checkout", () => {
		expect(findMonorepoRoot(join(CLI_DIR, "src"))).toBe(REPO_ROOT);
		expect(findMonorepoRoot(outside)).toBeUndefined();
	});

	test("resolves the root from tools/cli, where `bun --cwd tools/cli` runs", () => {
		process.chdir(CLI_DIR);
		expect(resolveMonorepoDir()).toBe(REPO_ROOT);
	});

	test("resolves the root from a directory outside the checkout", () => {
		process.chdir(outside);
		expect(resolveMonorepoDir()).toBe(REPO_ROOT);
	});

	test("reads a relative path from the process directory, then from the root", () => {
		process.chdir(CLI_DIR);
		expect(resolveInputPath("package.json", REPO_ROOT)).toBe(
			join(CLI_DIR, "package.json"),
		);
		expect(resolveInputPath("AGENTS.md", REPO_ROOT)).toBe(
			join(REPO_ROOT, "AGENTS.md"),
		);
		expect(resolveInputPath(join(outside, "x.json"), REPO_ROOT)).toBe(
			join(outside, "x.json"),
		);
	});
});
