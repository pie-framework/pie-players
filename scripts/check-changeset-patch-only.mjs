#!/usr/bin/env node

/**
 * Pre-version guard: reject any pending `.changeset/*.md` whose YAML
 * frontmatter declares a `minor` or `major` bump for a publishable package.
 *
 * The repo's release policy is **patch-only / lockstep** (see
 * `.cursor/rules/release-version-alignment.mdc`,
 * `AGENTS.md` "Release version alignment", and
 * `.claude/skills/releases-and-changesets/SKILL.md`):
 *
 *   - Every release publishes every publishable @pie-players/* package.
 *   - Every release is a `patch` bump — even for breaking changes — while
 *     the suite is on the pre-1.0 0.x.y line.
 *
 * Changesets uses the highest-declared bump in `.changeset/*.md` for the
 * whole lockstep set, so a single stray `major` would force the entire
 * suite to a new major version. `check-fixed-versioning.mjs` catches the
 * resulting drift after `bun run version` has already mutated package.json
 * / CHANGELOG.md files; this guard catches the offending changeset BEFORE
 * any mutation, with a clearer error pointing the author at the rule.
 *
 * Wired into `verify:publish` (so PR/CI runs surface the failure) and as
 * the very first step of `release:with-version` (so a stray entry blocks
 * the entire local-publish flow before any side effects).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const ALLOWED_BUMP = "patch";
const RULE_PATH = ".cursor/rules/release-version-alignment.mdc";

const fail = (message) => {
	console.error(`[check-changeset-patch-only] ${message}`);
	process.exit(1);
};

if (!existsSync(CHANGESET_DIR)) {
	fail(`Missing .changeset directory at ${CHANGESET_DIR}.`);
}

const changesetFiles = readdirSync(CHANGESET_DIR, { withFileTypes: true })
	.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
	.filter((entry) => entry.name.toLowerCase() !== "readme.md")
	.map((entry) => path.join(CHANGESET_DIR, entry.name));

/**
 * Extract the YAML frontmatter block (between the first two `---` markers) as
 * an array of trimmed lines. Returns an empty array when the file has no
 * frontmatter (e.g. a changesets README).
 */
const extractFrontmatter = (filePath) => {
	const content = readFileSync(filePath, "utf8");
	const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(\r?\n|$)/);
	if (!match) return [];
	return match[1].split(/\r?\n/);
};

/**
 * Parse a `'@pie-players/foo': patch` (or double-quoted, or unquoted)
 * frontmatter line. Returns `{ packageName, bump }` or `null` when the line
 * is blank, a comment, or otherwise unrecognised.
 *
 * Tolerates all three forms because the Changesets CLI emits single-quoted
 * keys, but a hand-edited entry written as `@pie-players/foo: minor` (valid
 * YAML) would silently bypass this guard if we required quotes.
 */
const parseBumpLine = (rawLine) => {
	const line = rawLine.trim();
	if (!line || line.startsWith("#")) return null;
	const match = line.match(
		/^(?:["'](?<quoted>[^"']+)["']|(?<bare>[^"'\s:][^\s:]*))\s*:\s*(?<bump>[A-Za-z]+)\s*$/,
	);
	if (!match?.groups) return null;
	const packageName = match.groups.quoted ?? match.groups.bare;
	if (!packageName) return null;
	return { packageName, bump: match.groups.bump.toLowerCase() };
};

const violations = [];

for (const filePath of changesetFiles) {
	const lines = extractFrontmatter(filePath);
	for (const line of lines) {
		const parsed = parseBumpLine(line);
		if (!parsed) continue;
		if (parsed.bump === ALLOWED_BUMP) continue;
		violations.push({
			file: path.relative(ROOT, filePath),
			packageName: parsed.packageName,
			bump: parsed.bump,
		});
	}
}

if (violations.length > 0) {
	const formatted = violations
		.map(
			({ file, packageName, bump }) =>
				`  - ${file}: "${packageName}" declares "${bump}" (must be "${ALLOWED_BUMP}")`,
		)
		.join("\n");
	fail(
		[
			`Found ${violations.length} non-patch bump declaration(s) in pending changesets:`,
			formatted,
			"",
			"Policy: every release on the pre-1.0 0.x.y line is a `patch` bump,",
			"even for breaking changes. Document the breaking change in the",
			"changeset body, but ship it under `patch`.",
			"",
			`See ${RULE_PATH}.`,
		].join("\n"),
	);
}

console.log(
	`[check-changeset-patch-only] OK: ${changesetFiles.length} changeset file(s) scanned, all bump levels are "${ALLOWED_BUMP}".`,
);
