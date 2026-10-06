import { describe, expect, test } from "bun:test";

import {
	ciScope,
	isDocumentationOnly,
	isDocumentationPath,
} from "../lib/change-scope.mjs";

describe("isDocumentationPath", () => {
	test.each([
		"AGENTS.md",
		"README.md",
		"docs/item-player/loading-strategies.md",
		"docs/adr/0003-elements-read-accessibility-settings-from-a-host-neutral-context.md",
		"docs/img/architecture.png",
		"docs/tools-and-accomodations/assets/schoolcity-gap-analysis/gap.jpg",
		".claude/skills/releases-and-changesets/SKILL.md",
		".claude/launch.json",
	])("%s is documentation", (path) => {
		expect(isDocumentationPath(path)).toBe(true);
	});

	test.each([
		// Shipped in a tarball and read by package tests.
		"packages/section-player/README.md",
		// Release input.
		".changeset/preloaded-one-release-rationale.md",
		// biome lints these.
		"docs/accessibility/aws-polly-iam-policy.json",
		"docs/item-player/pie-item-player-vs-legacy.html",
		"docs/wcag/reference-index.yaml",
		// The docs site is code.
		"apps/docs/src/routes/+page.svelte",
		"package.json",
		".github/workflows/ci.yml",
		"tools/cli/src/commands/docs/generate.md",
	])("%s is code", (path) => {
		expect(isDocumentationPath(path)).toBe(false);
	});
});

describe("isDocumentationOnly", () => {
	test("needs every path to be documentation", () => {
		expect(isDocumentationOnly(["AGENTS.md", "docs/readme.md"])).toBe(true);
		expect(isDocumentationOnly(["AGENTS.md", "bun.lock"])).toBe(false);
	});

	test("treats no paths as not documentation-only", () => {
		expect(isDocumentationOnly([])).toBe(false);
	});
});

describe("ciScope", () => {
	const pullRequest = (changedPaths, skipHeavy = false) =>
		ciScope({ eventName: "pull_request", skipHeavy, changedPaths });

	test("runs everything for a code change", () => {
		expect(pullRequest(["packages/item-player/src/index.ts"])).toEqual({
			skipCode: false,
			skipDocs: false,
			skipAudit: false,
			skipCortex: true,
		});
	});

	test("runs only Docs for a documentation-only change", () => {
		expect(pullRequest(["docs/readme.md", "AGENTS.md"])).toEqual({
			skipCode: true,
			skipDocs: false,
			skipAudit: true,
			skipCortex: true,
		});
	});

	test("keeps only the audit for a release pull request", () => {
		expect(pullRequest(["packages/theme/package.json"], true)).toEqual({
			skipCode: true,
			skipDocs: true,
			skipAudit: false,
			skipCortex: true,
		});
	});

	test("runs Cortex when its inputs change", () => {
		for (const path of [
			"packages/calculator-cortex/src/index.ts",
			"packages/calculator/src/contract.ts",
			"bun.lock",
			"scripts/lib/change-scope.mjs",
		]) {
			expect(pullRequest([path]).skipCortex).toBe(false);
		}
	});

	test("runs everything when the paths could not be listed", () => {
		expect(pullRequest(null)).toEqual({
			skipCode: false,
			skipDocs: false,
			skipAudit: false,
			skipCortex: false,
		});
	});

	test("runs everything, Cortex included, on a push", () => {
		expect(
			ciScope({
				eventName: "push",
				skipHeavy: false,
				changedPaths: ["docs/readme.md"],
			}),
		).toEqual({
			skipCode: false,
			skipDocs: false,
			skipAudit: false,
			skipCortex: false,
		});
	});
});
