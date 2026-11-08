/**
 * Keeps the licence notices of bundled third-party code in published output.
 *
 * Vite 8 strips every legal comment (`@license`, `@preserve`, `/*!`) from a
 * build with `build.minify` set, in the bundler and again in the esbuild
 * minify pass, and the notices of DOMPurify and lit went with them. Their
 * licences (BSD-3-Clause, Apache-2.0, MPL-2.0, MIT) require the notice to
 * travel with a redistributed copy.
 *
 * MathJax, speech-rule-engine, MathLive, the Compute Engine and JSXGraph ship
 * no legal comment upstream, so there is nothing to preserve. The plugin adds a
 * one-line notice to every chunk that inlines one of them instead.
 *
 * Every Vite build that produces published JavaScript lists
 * `preserveLegalComments()`; `check:bundle-safety` fails on a published `dist`
 * file that inlines a library from `LICENSED_LIBRARIES` and carries no notice
 * for it.
 *
 * Lives at the package root beside `source-map-comment-text.mjs`, outside
 * `src/`, so it never lands in `dist`. Plain JavaScript, because it is loaded
 * by Vite configs and by Node scripts.
 */

/**
 * Libraries whose licence requires a notice in a redistributed copy.
 *
 * `signature` holds strings that a minifier keeps (config keys, event names,
 * message text) and that appear together only inside the library itself. A file
 * is taken to inline the library when it contains every one. `notice` matches
 * the notice a file must carry. A `banner` marks a library that ships no notice
 * of its own; the plugin writes it into the chunk.
 */
export const LICENSED_LIBRARIES = [
	{
		name: "DOMPurify",
		signature: ["ADD_DATA_URI_TAGS", "FORBID_CONTENTS", "USE_PROFILES"],
		notice: /@license DOMPurify\b/,
	},
	{
		name: "lit",
		signature: ["litHtmlVersions"],
		notice: /SPDX-License-Identifier: BSD-3-Clause/,
	},
	{
		name: "MathJax",
		signature: ["MathJax_Menu", "MathJax localStorage error"],
		notice: /@license MathJax\b/,
		banner:
			"/*! @license MathJax | Apache-2.0 | https://github.com/mathjax/MathJax-src/blob/master/LICENSE */",
	},
	{
		name: "speech-rule-engine",
		signature: ["cdn.jsdelivr.net/npm/speech-rule-engine"],
		notice: /@license speech-rule-engine\b/,
		banner:
			"/*! @license speech-rule-engine | Apache-2.0 | https://github.com/zorkow/speech-rule-engine/blob/master/LICENSE */",
	},
	{
		name: "MathLive",
		signature: ["MathfieldElement", "mathVirtualKeyboard"],
		notice: /@license MathLive\b/,
		banner:
			"/*! @license MathLive | MIT | Copyright (c) 2017 - present Arno Gourdol */",
	},
	{
		name: "Compute Engine",
		signature: ["LogGamma", "Factorial2"],
		notice: /@license Compute Engine\b/,
		banner:
			"/*! @license Compute Engine | MIT | Copyright (c) 2019 CortexJS */",
	},
	{
		name: "JSXGraph",
		signature: ["JXG.Math", "JXG.boards"],
		notice: /@license JSXGraph\b/,
		banner:
			"/*! @license JSXGraph | MIT OR LGPL-3.0-or-later, used under MIT | Copyright (C) 2008-2012 Matthias Ehmann, Michael Gerhaeuser, Carsten Miller, Bianca Valentin, Alfred Wassermann, Peter Wilfahrt */",
	},
];

/** The libraries `code` inlines whose notice it lacks. */
export function findLibrariesMissingNotice(code) {
	return LICENSED_LIBRARIES.filter(
		(library) =>
			library.signature.every((marker) => code.includes(marker)) &&
			!library.notice.test(code),
	);
}

/**
 * Vite plugin with three jobs. The bundler keeps legal comments, the esbuild
 * minify pass leaves them inline, and a chunk that inlines a library with no
 * upstream notice gets one. The `config` hook merges into the build's own
 * options, so an entry that sets `rollupOptions.output` keeps its settings.
 */
export function preserveLegalComments() {
	return {
		name: "pie-preserve-legal-comments",
		config() {
			return {
				esbuild: { legalComments: "inline" },
				build: {
					rolldownOptions: {
						output: { comments: { legal: true } },
					},
				},
			};
		},
		renderChunk(code) {
			const banners = findLibrariesMissingNotice(code)
				.map((library) => library.banner)
				.filter(Boolean);
			if (banners.length === 0) return null;
			return { code: `${banners.join("\n")}\n${code}`, map: null };
		},
	};
}
