/**
 * The repository's Markdown documentation, one definition for the checks that
 * read it (`check:docs:links`, `check:docs:imports`, `check:docs:examples`):
 *
 * - every `.md` under `docs/` and under a package's `docs/`;
 * - elsewhere, files with a documentation name (`README.md`, `ARCHITECTURE.md`
 *   and the others in `DOC_FILE_NAMES`).
 *
 * CHANGELOGs are generated, and build output, dependencies and `.claude/`
 * (agent worktrees hold whole copies of the repository) are not walked.
 */

import { readdirSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
	".claude",
	".git",
	".svelte-kit",
	".turbo",
	"build",
	"dist",
	"node_modules",
	"coverage",
	"local-builds",
]);

const DOC_FILE_NAMES = new Set([
	"README.md",
	"readme.md",
	"ARCHITECTURE.md",
	"USAGE_EXAMPLE.md",
	"AGENTS.md",
	"GETTING-STARTED.md",
	"INTEGRATION-GUIDE.md",
]);

/** @param {string} relative A root-relative path with forward slashes. */
export function isMarkdownDoc(relative) {
	const base = path.posix.basename(relative);
	if (!relative.endsWith(".md")) return false;
	if (base === "CHANGELOG.md") return false;
	if (relative.startsWith("docs/")) return true;
	if (/^packages\/[^/]+\/docs\//.test(relative)) return true;
	return DOC_FILE_NAMES.has(base);
}

/** Absolute paths of the documentation under `root`, sorted. */
export function markdownDocs(root) {
	const files = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
				continue;
			}
			const relative = path.relative(root, fullPath).replaceAll(path.sep, "/");
			if (isMarkdownDoc(relative)) files.push(fullPath);
		}
	};
	walk(root);
	return files.sort();
}
