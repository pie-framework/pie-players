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
 * one-line notice to every chunk whose modules come from one of them instead,
 * judged by module id, because a split chunk such as MathJax's TeX input or a
 * font table keeps none of the strings that identify the library.
 *
 * A one-line notice carries neither the copyright line MIT asks for nor the
 * licence text BSD-3-Clause and Apache-2.0 ask for, and most inlined packages
 * (Svelte's runtime, complex.js and the rest) carry no legal comment at all. So
 * the build also writes `THIRD-PARTY-LICENSES.txt` beside its output: every
 * `node_modules` package the bundle inlines, with its version, licence field
 * and the licence file it ships.
 *
 * Every Vite build that produces published JavaScript lists
 * `preserveLegalComments()`; `check:bundle-safety` fails on a published `dist`
 * file that inlines a library from `LICENSED_LIBRARIES` and carries no notice
 * for it, and on one that inlines a library its nearest
 * `THIRD-PARTY-LICENSES.txt` does not list.
 *
 * Lives at the package root beside `source-map-comment-text.mjs`, outside
 * `src/`, so it never lands in `dist`. Plain JavaScript, because it is loaded
 * by Vite configs and by Node scripts.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Libraries whose licence requires a notice in a redistributed copy.
 *
 * `modules` matches the module ids of the library's files, which is how the
 * plugin decides a chunk inlines it. `signatures` serves the dist check, which
 * has no module ids: each entry holds strings that a minifier keeps (config
 * keys, event names, message text) and that appear together only inside the
 * library, and a file is taken to inline the library when it contains every
 * string of any entry. `notice` matches the notice a file must carry. A
 * `banner` marks a library that ships no notice of its own; the plugin writes it
 * into the chunk. `embedded` describes the library where another package ships
 * it pre-bundled (`EMBEDDING_PACKAGES`), with its licence text in `licenses/`.
 */
export const LICENSED_LIBRARIES = [
	{
		name: "DOMPurify",
		modules: /\/node_modules\/dompurify\//,
		signatures: [["ADD_DATA_URI_TAGS", "FORBID_CONTENTS", "USE_PROFILES"]],
		notice: /@license DOMPurify\b/,
	},
	{
		name: "lit",
		modules: /\/node_modules\/(?:lit|lit-html|lit-element|@lit\/reactive-element)\//,
		signatures: [["litHtmlVersions"]],
		notice: /SPDX-License-Identifier: BSD-3-Clause/,
		embedded: { package: "lit", license: "BSD-3-Clause", text: "lit.txt" },
	},
	{
		name: "MathJax",
		modules: /\/node_modules\/(?:mathjax|mathjax-full|@mathjax\/[^/]+)\//,
		signatures: [
			["MathJax_Menu", "MathJax localStorage error"],
			["MathJax maximum macro substitution count exceeded"],
			[".dynamicSetup(\""],
		],
		notice: /@license MathJax\b/,
		embedded: { package: "mathjax", license: "Apache-2.0", text: "mathjax.txt" },
		banner:
			"/*! @license MathJax | Apache-2.0 | https://github.com/mathjax/MathJax-src/blob/master/LICENSE */",
	},
	{
		name: "speech-rule-engine",
		modules: /\/node_modules\/speech-rule-engine\//,
		signatures: [["cdn.jsdelivr.net/npm/speech-rule-engine"]],
		notice: /@license speech-rule-engine\b/,
		embedded: {
			package: "speech-rule-engine",
			license: "Apache-2.0",
			text: "speech-rule-engine.txt",
		},
		banner:
			"/*! @license speech-rule-engine | Apache-2.0 | https://github.com/zorkow/speech-rule-engine/blob/master/LICENSE */",
	},
	{
		name: "MathLive",
		modules: /\/node_modules\/mathlive\//,
		signatures: [["MathfieldElement", "mathVirtualKeyboard"]],
		notice: /@license MathLive\b/,
		banner:
			"/*! @license MathLive | MIT | Copyright (c) 2017 - present Arno Gourdol */",
	},
	{
		name: "Compute Engine",
		modules: /\/node_modules\/@cortex-js\/compute-engine\//,
		signatures: [["LogGamma", "Factorial2"]],
		notice: /@license Compute Engine\b/,
		banner:
			"/*! @license Compute Engine | MIT | Copyright (c) 2019 CortexJS */",
	},
	{
		name: "JSXGraph",
		modules: /\/node_modules\/jsxgraph\//,
		signatures: [["JXG.Math", "JXG.boards"]],
		notice: /@license JSXGraph\b/,
		banner:
			"/*! @license JSXGraph | MIT OR LGPL-3.0-or-later, used under MIT | Copyright (C) 2008-2012 Matthias Ehmann, Michael Gerhaeuser, Carsten Miller, Bianca Valentin, Alfred Wassermann, Peter Wilfahrt */",
	},
];

/**
 * Packages that ship a library pre-bundled, so the library's code carries the
 * embedding package's module id and has no `node_modules` root of its own to
 * read a licence from.
 */
export const EMBEDDING_PACKAGES = [
	{
		name: "@pie-element/shared-math-rendering-mathjax",
		modules: /\/node_modules\/@pie-element\/shared-math-rendering-mathjax\//,
		embeds: ["MathJax", "speech-rule-engine"],
	},
	{
		name: "@pie-lib/math-rendering-module",
		modules: /\/node_modules\/@pie-lib\/math-rendering-module\//,
		embeds: ["MathJax", "speech-rule-engine"],
	},
	{
		name: "the vendored NDS icon button",
		modules: /\/players-shared\/(?:src|dist)\/components\/vendor\/nds\//,
		embeds: ["lit"],
	},
];

/** A Rollup module id as a file path: no `\0` prefix, query or hash. */
const moduleFile = (id) => id.replace(/^\0/, "").replace(/[?#].*$/, "");

/** The `LICENSED_LIBRARIES` entries `file`'s code belongs to, directly or embedded. */
function librariesOfModule(file) {
	const embedded = EMBEDDING_PACKAGES.filter((entry) =>
		entry.modules.test(file),
	).flatMap((entry) => entry.embeds);
	return LICENSED_LIBRARIES.filter(
		(library) => library.modules.test(file) || embedded.includes(library.name),
	);
}

/** The libraries `code` inlines, by signature, whose notice it lacks. */
export function findLibrariesMissingNotice(code) {
	return LICENSED_LIBRARIES.filter(
		(library) =>
			library.signatures.some((markers) =>
				markers.every((marker) => code.includes(marker)),
			) && !library.notice.test(code),
	);
}

/** The libraries a chunk of `moduleIds` inlines whose notice `code` lacks. */
export function findChunkLibrariesMissingNotice(code, moduleIds) {
	const inlined = new Set(
		moduleIds.flatMap((id) => librariesOfModule(moduleFile(id))),
	);
	return [...inlined].filter((library) => !library.notice.test(code));
}

export const THIRD_PARTY_NOTICES_FILE = "THIRD-PARTY-LICENSES.txt";

const NOTICES_RULE = "=".repeat(72);

/**
 * Svelte's runtime, which every Svelte package inlines and which carries no
 * legal comment: the notices file is where its notice lives. Shaped like a
 * `LICENSED_LIBRARIES` entry so the dist check treats both alike.
 */
export const SVELTE_RUNTIME = {
	name: "Svelte",
	modules: /\/node_modules\/svelte\//,
	signatures: [["svelte.dev/e/"]],
};

const noticeSectionsOf = (noticesText) =>
	noticesText.trimEnd().split(`\n\n${NOTICES_RULE}\n\n`).slice(1);

/** The package names a notices file lists. */
export function packagesListedIn(noticesText) {
	return noticeSectionsOf(noticesText).map(
		(section) => section.split(/\s/, 1)[0],
	);
}

/**
 * The notices file covering `file` when it sits in a package's built output: the
 * nearest one in its directory or an ancestor, up to the package root. A
 * package's sources sit beside its `dist`, not below it, so none of them has one.
 */
export function builtNoticesFileFor(file, exists) {
	let dir = path.dirname(file);
	while (!exists(path.join(dir, "package.json"))) {
		const candidate = path.join(dir, THIRD_PARTY_NOTICES_FILE);
		if (exists(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

/**
 * The libraries `code` inlines, by signature, that the notices file text
 * `noticesText` does not list. Null text stands for a missing file.
 */
export function findLibrariesMissingFromNotices(code, noticesText) {
	const listed = noticesText ? packagesListedIn(noticesText) : [];
	return [...LICENSED_LIBRARIES, SVELTE_RUNTIME].filter(
		(library) =>
			library.signatures.some((markers) =>
				markers.every((marker) => code.includes(marker)),
			) &&
			!listed.some((name) => library.modules.test(`/node_modules/${name}/`)),
	);
}

const LICENSE_FILE = /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i;

/**
 * The root of the `node_modules` package `file` belongs to: the directory below
 * its last `node_modules` segment, one level deeper for a scoped name. Null for a
 * file outside `node_modules`, which is this repository's own code.
 */
export function packageRootOf(file) {
	const segments = file.split(/[\\/]/);
	const at = segments.lastIndexOf("node_modules");
	if (at === -1 || at + 1 >= segments.length) return null;
	const depth = segments[at + 1].startsWith("@") ? 2 : 1;
	if (at + depth >= segments.length) return null;
	return segments.slice(0, at + 1 + depth).join("/");
}

const LICENSES_DIR = fileURLToPath(new URL("./licenses/", import.meta.url));
const PRE_BUNDLED_HEADING = /^(\S+) \(pre-bundled in (.+)\)$/;

const addEmbedder = (embedders, packageName, embedderName) => {
	if (!embedders.has(packageName)) embedders.set(packageName, new Set());
	embedders.get(packageName).add(embedderName);
};

/**
 * The text of `THIRD-PARTY-LICENSES.txt` for a bundle of `moduleFiles`: one
 * section per inlined `node_modules` package and version, sorted by name, with
 * its licence field and every licence file it ships, plus one per library an
 * embedding package carries pre-bundled. `@pie-players/*` packages are this
 * suite and carry its LICENSE, so they are left out. Null when nothing
 * third-party is inlined.
 */
export function renderThirdPartyNotices(moduleFiles, { readFile, readDir, exists }) {
	const sections = new Map();
	const packageNames = new Set();
	for (const root of new Set(moduleFiles.map(packageRootOf).filter(Boolean))) {
		const manifestPath = `${root}/package.json`;
		if (!exists(manifestPath)) continue;
		const manifest = JSON.parse(readFile(manifestPath));
		if (!manifest.name || manifest.name.startsWith("@pie-players/")) continue;
		const key = `${manifest.name} ${manifest.version ?? ""}`.trim();
		if (sections.has(key)) continue;
		packageNames.add(manifest.name);
		const license =
			typeof manifest.license === "string"
				? manifest.license
				: (manifest.license?.type ?? "not stated in its package.json");
		const texts = readDir(root)
			.filter((name) => LICENSE_FILE.test(name))
			.sort()
			.map((name) => readFile(`${root}/${name}`).trim());
		sections.set(
			key,
			[
				key,
				`License: ${license}`,
				"",
				texts.length > 0
					? texts.join("\n\n")
					: "The package ships no licence file; its package.json states the licence above.",
			].join("\n"),
		);
	}
	// A module from another package's built output, such as the item player's
	// chunks inside the section player's browser build, brings the sections of
	// the notices file that covers it.
	const embedders = new Map();
	for (const noticesPath of new Set(
		moduleFiles.map((file) => builtNoticesFileFor(file, exists)).filter(Boolean),
	)) {
		for (const section of noticeSectionsOf(readFile(noticesPath))) {
			const heading = section.split("\n", 1)[0];
			const preBundled = heading.match(PRE_BUNDLED_HEADING);
			if (preBundled) {
				for (const name of preBundled[2].split(", ")) {
					addEmbedder(embedders, preBundled[1], name);
				}
			} else if (!sections.has(heading)) {
				sections.set(heading, section);
				packageNames.add(heading.split(" ", 1)[0]);
			}
		}
	}
	for (const embedding of EMBEDDING_PACKAGES) {
		if (!moduleFiles.some((file) => embedding.modules.test(file))) continue;
		for (const libraryName of embedding.embeds) {
			const { embedded } = LICENSED_LIBRARIES.find(
				(library) => library.name === libraryName,
			);
			addEmbedder(embedders, embedded.package, embedding.name);
		}
	}
	// One section per pre-bundled library, naming every package that carries
	// it. An installed copy's section already holds the same licence.
	for (const [packageName, names] of embedders) {
		if (packageNames.has(packageName)) continue;
		const { embedded } = LICENSED_LIBRARIES.find(
			(library) => library.embedded?.package === packageName,
		);
		const heading = `${packageName} (pre-bundled in ${[...names].sort().join(", ")})`;
		sections.set(
			heading,
			[
				heading,
				`License: ${embedded.license}`,
				"",
				readFile(path.join(LICENSES_DIR, embedded.text)).trim(),
			].join("\n"),
		);
	}
	if (sections.size === 0) return null;
	return `${[
		"Third-party software included in this package's bundles, with the licence each is used under.",
		...[...sections.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([, section]) => section),
	].join(`\n\n${NOTICES_RULE}\n\n`)}\n`;
}

/** `node:fs` in the shape `renderThirdPartyNotices` reads through. */
export const nodeFileReader = {
	readFile: (file) => readFileSync(file, "utf8"),
	readDir: (dir) => readdirSync(dir),
	exists: existsSync,
};

/**
 * Vite plugin with four jobs. The bundler keeps legal comments, the esbuild
 * minify pass leaves them inline, a chunk with modules from a library that has
 * no upstream notice gets one, and the build writes `THIRD-PARTY-LICENSES.txt`
 * for everything it inlines from `node_modules`. The `config` hook merges into
 * the build's own options, so an entry that sets `rollupOptions.output` keeps
 * its settings. `{ notices: false }` skips the notices file, for a worker build
 * whose modules the main build inlines as well.
 */
export function preserveLegalComments({ notices = true } = {}) {
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
		renderChunk(code, chunk) {
			const banners = findChunkLibrariesMissingNotice(code, chunk.moduleIds ?? [])
				.map((library) => library.banner)
				.filter(Boolean);
			if (banners.length === 0) return null;
			return { code: `${banners.join("\n")}\n${code}`, map: null };
		},
		generateBundle(_options, bundle) {
			if (!notices) return;
			const files = Object.values(bundle)
				.filter((output) => output.type === "chunk")
				.flatMap((chunk) => (chunk.moduleIds ?? []).map(moduleFile));
			const text = renderThirdPartyNotices(files, nodeFileReader);
			if (text) {
				this.emitFile({ type: "asset", fileName: THIRD_PARTY_NOTICES_FILE, source: text });
			}
		},
	};
}
