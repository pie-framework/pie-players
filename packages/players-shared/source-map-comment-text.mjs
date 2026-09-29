/**
 * Escapes source-map comment text inside published bundles, so a host's
 * source-map-loader leaves the code intact.
 *
 * source-map-loader, which Angular's development builds run over every
 * node_modules file, strips anything matching a `//# sourceMappingURL=`
 * comment wherever it appears, string and template literals included. The
 * vendored es-module-shims keeps that text in a template literal, and stripping
 * it leaves the module unparseable. Escaping the `=` as `\x3d` gives the same
 * string at runtime and no longer matches.
 *
 * The vendoring script escapes the module it writes, and every Vite build that
 * bundles it lists `escapeSourceMapCommentTextInOutput()`, because Vite
 * re-prints bundled literals and drops the escape. `check:bundle-safety` fails
 * on the unescaped text in any published `dist`.
 *
 * Lives at the package root beside `svelte-custom-element-guard.ts`, outside
 * `src/`, so it never lands in `dist`. Plain JavaScript, because the vendoring
 * script runs under Node without a TypeScript loader.
 */

/** The comment source-map-loader matches, as in its `sourceMappingURLRegex`. */
export const SOURCE_MAP_COMMENT_TEXT =
	/(\/\/|\/\*)(\s*[#@]\s*sourceMappingURL\s*)=/g;

/** `code` with every source-map comment's `=` escaped as `\x3d`. */
export function escapeSourceMapCommentText(code) {
	return code.replace(SOURCE_MAP_COMMENT_TEXT, "$1$2\\x3d");
}

/** Vite plugin applying `escapeSourceMapCommentText` to every output chunk. */
export function escapeSourceMapCommentTextInOutput() {
	return {
		name: "escape-source-map-comment-text",
		generateBundle(_options, bundle) {
			for (const output of Object.values(bundle)) {
				if (output.type === "chunk") {
					output.code = escapeSourceMapCommentText(output.code);
				}
			}
		},
	};
}
