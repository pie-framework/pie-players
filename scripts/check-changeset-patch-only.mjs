#!/usr/bin/env node

/**
 * Pre-version guard: reject any pending `.changeset/*.md` whose YAML
 * frontmatter declares a bump above `patch` for a publishable package.
 *
 * The repo's release policy is **patch-only / lockstep** (see
 * `AGENTS.md` "Release Version Alignment" and
 * `.agents/skills/releases-and-changesets/SKILL.md`):
 *
 *   - Every release publishes every publishable @pie-players/* package.
 *   - Every release is a `patch` bump — even for breaking changes.
 *
 * The one exception opens the 1.0 prerelease line: while `.changeset/pre.json`
 * is in `pre` mode and the lockstep group is still on `0.x`, `major` is
 * allowed, and at least one pending changeset must declare it, so the line
 * opens at `1.0.0-<tag>.0` instead of a prerelease of the next `0.x` patch.
 * From `1.0.0-<tag>.0` on, a `patch` entry advances the prerelease counter;
 * changesets moves consumed entries to `.changeset/pre/`, which this guard
 * does not scan.
 *
 * Changesets uses the highest-declared bump in `.changeset/*.md` for the
 * whole lockstep set, so a single stray `major` would force the entire
 * suite to a new major version. `check-fixed-versioning.mjs` catches the
 * resulting drift after `bun run version` has already mutated package.json
 * / CHANGELOG.md files; this guard catches the offending changeset BEFORE
 * any mutation, with a clearer error pointing the author at the rule.
 *
 * Wired into `verify:pre-commit`, `verify:local-pr` and `verify:publish`
 * (which the release workflow runs), and as the very first step of
 * `release:with-version` (so a stray entry blocks the entire local-publish
 * flow before any side effects). PR CI does not run it.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseSemver } from "./lib/fixed-versioning.mjs";

const ROOT = process.cwd();
const CHANGESET_DIR = path.join(ROOT, ".changeset");
const PRE_STATE_PATH = path.join(CHANGESET_DIR, "pre.json");
const CHANGESET_CONFIG_PATH = path.join(CHANGESET_DIR, "config.json");
const PACKAGE_ROOT = path.join(ROOT, "packages");
const ALLOWED_BUMP = "patch";
const ONE_ZERO_BUMP = "major";
const RULE_PATH = "AGENTS.md";

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

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

/** Local versions of the packages in the changesets `fixed` block. */
const readFixedGroupVersions = () => {
	const fixed = new Set((readJson(CHANGESET_CONFIG_PATH).fixed ?? []).flat());
	return readdirSync(PACKAGE_ROOT, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(PACKAGE_ROOT, entry.name, "package.json"))
		.filter((manifestPath) => existsSync(manifestPath))
		.map((manifestPath) => readJson(manifestPath))
		.filter((manifest) => fixed.has(manifest.name))
		.map((manifest) => manifest.version);
};

/**
 * True while changesets prerelease mode is about to open the 1.0 line: `pre.json` is in
 * `pre` mode and the lockstep group has not left `0.x` yet.
 */
const opensOneZeroPrereleaseLine = () => {
	if (!existsSync(PRE_STATE_PATH)) return false;
	if (readJson(PRE_STATE_PATH).mode !== "pre") return false;
	const versions = readFixedGroupVersions().map(parseSemver);
	return versions.length > 0 && versions.every((semver) => semver?.major === 0);
};

const oneZeroLine = opensOneZeroPrereleaseLine();
const violations = [];
let declaresOneZero = false;

for (const filePath of changesetFiles) {
	const lines = extractFrontmatter(filePath);
	for (const line of lines) {
		const parsed = parseBumpLine(line);
		if (!parsed) continue;
		if (parsed.bump === ALLOWED_BUMP) continue;
		if (oneZeroLine && parsed.bump === ONE_ZERO_BUMP) {
			declaresOneZero = true;
			continue;
		}
		violations.push({
			file: path.relative(ROOT, filePath),
			packageName: parsed.packageName,
			bump: parsed.bump,
		});
	}
}

if (oneZeroLine && !declaresOneZero) {
	fail(
		[
			".changeset/pre.json is in pre mode on 0.x, but no pending changeset declares `major`.",
			"Without it the line versions as a prerelease of the next 0.x patch instead of 1.0.0.",
			"",
			"See docs/setup/publishing.md#prerelease-lines.",
		].join("\n"),
	);
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
			"Policy: every release is a `patch` bump, even for breaking changes.",
			"Document the breaking change in the changeset body, but ship it under",
			"`patch`. Opening the 1.0 prerelease line alone admits `major`",
			"(docs/setup/publishing.md#prerelease-lines).",
			"",
			`See ${RULE_PATH}.`,
		].join("\n"),
	);
}

console.log(
	oneZeroLine
		? `[check-changeset-patch-only] OK: ${changesetFiles.length} changeset file(s) scanned while opening the 1.0 prerelease line, every bump level is "${ALLOWED_BUMP}" or "${ONE_ZERO_BUMP}".`
		: `[check-changeset-patch-only] OK: ${changesetFiles.length} changeset file(s) scanned, all bump levels are "${ALLOWED_BUMP}".`,
);
