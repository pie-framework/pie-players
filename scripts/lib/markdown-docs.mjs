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

/**
 * GitHub's heading slug: lower-cased, punctuation other than `-` and `_` dropped,
 * spaces to hyphens. Link and inline-HTML syntax is reduced to its text first,
 * because GitHub slugs the rendered heading; a code span's text is literal, so
 * the `<pie-item-list>` in `` ## `<pie-item-list>` `` is not a tag.
 */
export function headingSlug(heading) {
	return heading
		.split(/(`[^`]*`)/)
		.map((part, index) =>
			index % 2 === 1
				? part
				: part
						.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
						.replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
						.replace(/<[^>]+>/g, ""),
		)
		.join("")
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
		.replace(/ /g, "-");
}

/**
 * The fragments a Markdown document answers to on GitHub: one per ATX heading
 * (a repeated slug gains `-1`, `-2`, ... as GitHub numbers it) and one per
 * explicit `<a id>` / `<a name>`. Fenced code is not scanned.
 */
export function markdownAnchors(content) {
	const anchors = new Set();
	const seen = new Map();
	let fence = null;

	for (const line of content.split(/\r?\n/)) {
		const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
		if (fenceMatch) {
			const marker = fenceMatch[1];
			if (fence === null) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length)
				fence = null;
			continue;
		}
		if (fence !== null) continue;

		for (const match of line.matchAll(/<a\s[^>]*\b(?:id|name)=["']([^"']+)["']/gi)) {
			anchors.add(match[1]);
		}

		const heading = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(line);
		if (!heading) continue;
		const slug = headingSlug(heading[1]);
		const count = seen.get(slug) ?? 0;
		seen.set(slug, count + 1);
		anchors.add(count === 0 ? slug : `${slug}-${count}`);
	}

	return anchors;
}
