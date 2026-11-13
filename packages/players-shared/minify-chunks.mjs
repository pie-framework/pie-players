/**
 * Minifies the final chunks of a Vite build, whitespace included, and keeps
 * their legal comments.
 *
 * Vite 8 with `build.minify: "esbuild"` leaves whitespace in a `build.lib` ES
 * build and mangles identifiers and syntax only, so every published bundle
 * carried about a quarter more bytes than a full minify writes. This plugin
 * runs esbuild's complete minify over each emitted JavaScript chunk instead;
 * a config lists it with `build.minify: false`, and `configResolved` throws
 * when both minify.
 *
 * The pass runs in `generateBundle`, after every `renderChunk`. Vite's own
 * `vite:esbuild-transpile` re-prints each chunk without minifying whenever
 * `build.target` is below `esnext`, so a minify in `renderChunk` comes back
 * with its whitespace restored.
 *
 * `legalComments: "inline"` leaves `@license`, `@preserve` and `/*!` comments,
 * and the notices `preserveLegalComments()` adds, where they stand.
 *
 * The minify drops `/* @__PURE__ *\/` annotations from the output. A published
 * bundle is an entry whose top level registers custom elements, so a consumer
 * bundler has no unused top-level call to remove.
 *
 * A bundle with a source map cannot take this plugin, because the pass would
 * need to chain the maps; no PIE package ships one, and `configResolved`
 * throws on `build.sourcemap`.
 *
 * Lives at the package root beside `legal-comments.mjs`, outside `src/`, so it
 * never lands in `dist`. Plain JavaScript, because Vite configs and Node
 * scripts load it.
 */

import { transform } from "esbuild";

import { escapeSourceMapCommentText } from "./source-map-comment-text.mjs";

const JS_CHUNK = /\.[cm]?js$/;

/** What Vite's own esbuild pass leaves to the target, kept for parity. */
const SUPPORTED = { "dynamic-import": true, "import-meta": true };

/**
 * `code` minified for `target`, with every legal comment kept in place and
 * source-map comment text escaped. The minifier prints `"\x3d"` back as `=`
 * and folds `"//# sourceMappingURL" + "="`, so the escape
 * `escapeSourceMapCommentTextInOutput()` applies would not survive this pass
 * wherever the two plugins fall in the order.
 */
export async function minifyChunk(code, target) {
	const result = await transform(code, {
		minify: true,
		legalComments: "inline",
		charset: "utf8",
		loader: "js",
		target: target || undefined,
		supported: SUPPORTED,
		sourcemap: false,
	});
	return escapeSourceMapCommentText(result.code);
}

/** Vite plugin applying `minifyChunk` to every JavaScript chunk of the bundle. */
export function minifyChunks() {
	let target;
	return {
		name: "pie-minify-chunks",
		apply: "build",
		enforce: "post",
		configResolved(config) {
			if (config.build.minify) {
				throw new Error(
					`pie-minify-chunks minifies the chunks itself; set build.minify to false (it is ${JSON.stringify(config.build.minify)})`,
				);
			}
			if (config.build.sourcemap) {
				throw new Error(
					"pie-minify-chunks does not chain source maps; set build.sourcemap to false",
				);
			}
			target = config.build.target;
		},
		async generateBundle(_options, bundle) {
			await Promise.all(
				Object.values(bundle).map(async (output) => {
					if (output.type !== "chunk" || !JS_CHUNK.test(output.fileName)) return;
					output.code = await minifyChunk(output.code, target);
					output.map = null;
				}),
			);
		},
	};
}
