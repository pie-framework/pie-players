import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { markdownDocs } from "../lib/markdown-docs.mjs";

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
