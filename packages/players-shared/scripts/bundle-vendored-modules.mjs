#!/usr/bin/env node
// Replaces tsc's output for each vendored module with one self-contained ESM
// bundle of its source and dependencies, so hosts install nothing for it, and
// writes the package's `THIRD-PARTY-LICENSES.txt`. Runs after tsc, which still
// emits the modules' declarations.
//
// Every dynamic `import()` in a bundle is marked for bundlers to leave alone:
// a vendored module imports URLs it computes at runtime, and webpack would
// otherwise replace `import(url)` with a lookup in its own module graph. Its
// source-map comment text is escaped; see `source-map-comment-text.mjs`.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import {
	THIRD_PARTY_NOTICES_FILE,
	nodeFileReader,
	renderThirdPartyNotices,
} from "../legal-comments.mjs";
import { escapeSourceMapCommentText } from "../source-map-comment-text.mjs";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Output module in `dist`, and the source bundled into it. */
const VENDORED_MODULES = [
	{ output: "loaders/module-shim.js", source: "es-module-shims" },
];

const DYNAMIC_IMPORT = /(?<![\w$.])import\((?!\/\* webpackIgnore)/g;
const RUNTIME_IMPORT = "import(/* webpackIgnore: true */ /* @vite-ignore */ ";

// The files the bundles inline, plus the vendored NDS button the build script
// copies into `dist` afterwards, which carries Lit pre-bundled.
const inlinedModuleFiles = [
	path.join(packageDir, "src/components/vendor/nds/nds-icon-button.js"),
];

for (const { output, source } of VENDORED_MODULES) {
	const result = await build({
		entryPoints: [source],
		absWorkingDir: packageDir,
		outfile: path.join(packageDir, "dist", output),
		bundle: true,
		format: "esm",
		platform: "browser",
		target: "es2020",
		minify: true,
		legalComments: "eof",
		logLevel: "warning",
		metafile: true,
		write: false,
	});
	inlinedModuleFiles.push(
		...Object.keys(result.metafile.inputs).map((input) =>
			path.resolve(packageDir, input),
		),
	);
	for (const file of result.outputFiles) {
		await writeFile(
			file.path,
			escapeSourceMapCommentText(
				file.text.replace(DYNAMIC_IMPORT, RUNTIME_IMPORT),
			),
		);
	}
}

// One file for the package, beside every bundle it covers: `dist/loaders/` and
// `dist/components/vendor/` both sit below it.
const notices = renderThirdPartyNotices(inlinedModuleFiles, nodeFileReader);
if (notices) {
	await writeFile(path.join(packageDir, "dist", THIRD_PARTY_NOTICES_FILE), notices);
}
