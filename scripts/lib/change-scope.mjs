/**
 * Which changed paths only the documentation checks read, and what CI runs for a change.
 *
 * One definition for both gates that skip work on a documentation-only change: CI
 * (scripts/ci-change-scope.mjs) and the pre-push hook (scripts/lib/push-scope.mjs). A path
 * counts as documentation only when nothing but `check:docs` reads it, so a change made of
 * such paths cannot fail a build, a test, a lint or a type check:
 *
 * - Markdown and images under `docs/`. Its JSON, YAML and HTML stay code: `biome lint`
 *   reads them.
 * - Markdown at the repository root. Package READMEs are not documentation here: they ship
 *   in the tarballs, and package tests read some of them.
 * - Everything under `.claude/`, which biome excludes and no check reads.
 *
 * `.changeset/` is not documentation: a changeset is release input.
 */

const DOCS_FILE = /^docs\/.+\.(md|png|jpe?g|gif|svg|webp)$/i;
const ROOT_MARKDOWN = /^[^/]+\.md$/i;

/** The paths Cortex's browser suite depends on, so a pull request touching one runs it. */
const CORTEX_INPUT =
	/^(packages\/calculator-cortex\/|packages\/calculator\/|package\.json$|bun\.lock$|\.github\/workflows\/ci\.yml$|scripts\/ci-change-scope\.mjs$|scripts\/lib\/change-scope\.mjs$)/;

/** @param {string} path A repository-relative path with forward slashes. */
export function isDocumentationPath(path) {
	return (
		DOCS_FILE.test(path) ||
		ROOT_MARKDOWN.test(path) ||
		path.startsWith(".claude/")
	);
}

/**
 * An empty list is not documentation-only: a change whose paths could not be listed, or
 * that has none, gets the full gate.
 *
 * @param {readonly string[]} paths
 */
export function isDocumentationOnly(paths) {
	return paths.length > 0 && paths.every(isDocumentationPath);
}

/**
 * The CI jobs to skip for one workflow run. Each flag is a skip, so a value CI could not
 * compute reads as "run".
 *
 * @param {object} args
 * @param {string} args.eventName `github.event_name`.
 * @param {boolean} args.skipHeavy A release pull request, or one opted out of heavy CI.
 * @param {readonly string[] | null} args.changedPaths The pull request's changed paths, or
 *   null when they could not be listed.
 * @returns {{skipCode: boolean, skipDocs: boolean, skipAudit: boolean, skipCortex: boolean}}
 */
export function ciScope({ eventName, skipHeavy, changedPaths }) {
	// Only a pull request is classified. A push to master runs everything, Cortex included.
	const paths = eventName === "pull_request" ? changedPaths : null;
	const docsOnly = paths !== null && isDocumentationOnly(paths);
	const cortexTouched =
		paths === null || paths.some((path) => CORTEX_INPUT.test(path));

	return {
		skipCode: skipHeavy || docsOnly,
		skipDocs: skipHeavy,
		// A documentation-only change cannot add a dependency. The release path keeps the audit.
		skipAudit: docsOnly,
		skipCortex: skipHeavy || !cortexTouched,
	};
}
