#!/usr/bin/env node
// Replaces tsc's output for each vendored module with one self-contained ESM
// bundle of its source and dependencies, so hosts install nothing for it. Runs
// after tsc, which still emits the modules' declarations.
//
// Every dynamic `import()` in a bundle is marked for bundlers to leave alone:
// a vendored module imports URLs it computes at runtime, and webpack would
// otherwise replace `import(url)` with a lookup in its own module graph.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Output module in `dist`, and the source bundled into it. */
const VENDORED_MODULES = [
	{ output: "moveable/index.js", source: path.join(packageDir, "src/moveable/index.ts") },
	{ output: "loaders/module-shim.js", source: "es-module-shims" },
];

const DYNAMIC_IMPORT = /(?<![\w$.])import\((?!\/\* webpackIgnore)/g;
const RUNTIME_IMPORT = "import(/* webpackIgnore: true */ /* @vite-ignore */ ";

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
		write: false,
	});
	for (const file of result.outputFiles) {
		await writeFile(file.path, file.text.replace(DYNAMIC_IMPORT, RUNTIME_IMPORT));
	}
}
