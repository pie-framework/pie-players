#!/usr/bin/env node
// Replaces tsc's output for src/moveable with one self-contained ESM bundle of
// `moveable` and its dependencies. Runs after tsc, which still emits the
// module's declarations.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
	entryPoints: [path.join(packageDir, "src/moveable/index.ts")],
	outfile: path.join(packageDir, "dist/moveable/index.js"),
	bundle: true,
	format: "esm",
	platform: "browser",
	target: "es2020",
	minify: true,
	legalComments: "eof",
	logLevel: "warning",
});
