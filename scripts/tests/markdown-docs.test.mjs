import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
	headingSlug,
	markdownAnchors,
	markdownDocs,
} from "../lib/markdown-docs.mjs";

test("lists docs, package docs and documentation-named files", () => {
	const root = mkdtempSync(path.join(tmpdir(), "pie-markdown-docs-"));
	const files = [
		"README.md",
		"CONTEXT.md",
		"docs/guide.md",
		"docs/prds/proposal.md",
		"docs/CHANGELOG.md",
		"packages/lib/README.md",
		"packages/lib/CHANGELOG.md",
		"packages/lib/docs/usage.md",
		"packages/lib/src/notes.md",
		"packages/lib/node_modules/dep/README.md",
		"packages/lib/dist/README.md",
		"apps/demo/README.md",
		// An agent worktree is a whole copy of the repository.
		".claude/worktrees/branch/README.md",
		".claude/worktrees/branch/docs/guide.md",
	];
	for (const file of files) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(path.join(root, file), "# Doc\n");
	}
	expect(markdownDocs(root).map((file) => path.relative(root, file))).toEqual([
		"README.md",
		"apps/demo/README.md",
		"docs/guide.md",
		"docs/prds/proposal.md",
		"packages/lib/README.md",
		"packages/lib/docs/usage.md",
	]);
});

test("slugs headings the way GitHub renders them", () => {
	expect(headingSlug("Local PR Gate")).toBe("local-pr-gate");
	expect(headingSlug("Guards (required)")).toBe("guards-required");
	expect(headingSlug("`<pie-item-list>`")).toBe("pie-item-list");
	expect(headingSlug("Step 3: wire the [routes](./routes.md)")).toBe(
		"step-3-wire-the-routes",
	);
	expect(headingSlug("`check:deps` and snake_case")).toBe(
		"checkdeps-and-snake_case",
	);
});

test("collects heading and explicit anchors outside fenced code", () => {
	const anchors = markdownAnchors(
		[
			"# Title",
			"## Usage",
			"```sh",
			"# not a heading",
			"```",
			"## Usage",
			'<a id="pinned"></a>',
		].join("\n"),
	);

	expect([...anchors].sort()).toEqual(["pinned", "title", "usage", "usage-1"]);
});
