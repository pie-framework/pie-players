/**
 * Whether a file's change between two revisions is *provably* semantically null.
 *
 * This exists so the consumer-pad guard stops firing on formatting-only diffs. Its
 * whole value is being blunt and hard to fool, so the bar here is proof, not
 * likelihood: every uncertain case must answer false and let the guard fire. A
 * wrong "no-op" verdict silently disables a check whose entire purpose is catching
 * breakage nothing else in the repo notices.
 *
 * That rules out the obvious shortcut. Comparing sources with whitespace stripped
 * is unsound — whitespace is significant inside string and template literals, so a
 * changed message or a changed CSS rule inside a template would compare equal. The
 * `;` biome adds when it expands a type literal is not whitespace at all and would
 * be missed the other way.
 *
 * So each kind of file gets a normaliser that is sound for that kind, or none:
 *
 * - JSON: parse both sides and compare. Key order is treated as significant, which
 *   is stricter than JSON semantics need and therefore safe.
 * - JS/TS: run both sides through biome's formatter and compare the output.
 *   Formatting is a normalising function, so equal normal forms mean the two
 *   sources differ only in formatting. Comments survive it, so a changed
 *   `biome-ignore` or a changed doc comment still reads as significant.
 * - Everything else — CSS, Svelte, HTML: no normaliser, so the comparison falls
 *   back to exact equality and any change is significant. Biome's formatter is
 *   disabled for Svelte in this repo anyway.
 */

const JSON_PATTERN = /\.json$/;
const JS_PATTERN = /\.(?:[cm]?[jt]s|[jt]sx)$/;

/** Both sides parse to the same JSON value. Throws nothing; invalid JSON is significant. */
function jsonEquivalent(before, after) {
	try {
		return (
			JSON.stringify(JSON.parse(before)) === JSON.stringify(JSON.parse(after))
		);
	} catch {
		return false;
	}
}

/**
 * @param {{
 *   file: string,
 *   before: string | null,
 *   after: string | null,
 *   formatSource: (file: string, source: string) => string | null,
 * }} input
 * `before`/`after` are null when the file is absent on that side. `formatSource`
 * returns null when it cannot format, which is treated as "cannot prove".
 * @returns {boolean}
 */
export function isNoOpChange({ file, before, after, formatSource }) {
	// An added or deleted file changes a surface by existing or ceasing to.
	if (before == null || after == null) return false;
	if (before === after) return true;

	if (JSON_PATTERN.test(file)) return jsonEquivalent(before, after);

	if (JS_PATTERN.test(file)) {
		const normalisedBefore = formatSource(file, before);
		const normalisedAfter = formatSource(file, after);
		if (normalisedBefore == null || normalisedAfter == null) return false;
		return normalisedBefore === normalisedAfter;
	}

	return false;
}
