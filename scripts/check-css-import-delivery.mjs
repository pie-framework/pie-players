#!/usr/bin/env bun
/**
 * Fails on a plain `import "….css"` inside a publishable package.
 *
 * Why this exists: every package under `packages/` builds as a library. A bare
 * CSS import in that setting is extracted to a `dist/*.css` file that the built
 * JS never references and that no `exports` entry exposes, so it reaches the page
 * zero times. It looks load-bearing and does nothing.
 *
 * That failure mode shipped six times. Once it hid a real accessibility
 * regression: `tool-annotation-toolbar/highlights.css` was imported this way,
 * never loaded, and silently forked from the copy that does load — taking the
 * high-contrast and print treatment for annotation highlights with it.
 *
 * The working alternatives, both already used in the repo:
 *   - import the stylesheet as text (`?raw`) and install it, as
 *     `pie-item-player` and `pie-print-player` do via `installContentStyles`;
 *   - put the rules in the component's own `<style>` block.
 *
 * Apps under `apps/` are exempt: they are bundled, not published as libraries,
 * so their CSS imports resolve normally.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_ROOT = join(ROOT, "packages");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".svelte"];
const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "build", ".turbo"]);

/**
 * Matches a side-effect-only CSS import: `import "x.css"` / `import 'x.css'`.
 * A query suffix (`?raw`, `?inline`, `?url`) means the file is being read as a
 * value rather than relied on as a stylesheet, which is the supported path.
 *
 * Anchored at the start of the line (after indentation) on purpose. An
 * unanchored pattern also matches the *advice* embedded in strings — the
 * `auditContentStyles` warning tells hosts to
 * `import "@pie-players/pie-theme/components.css"`, and a check that fails on
 * its own documentation is a check people switch off.
 */
const PLAIN_CSS_IMPORT =
	/^\s*import\s+(?:"([^"]+\.css)"|'([^']+\.css)')\s*;?\s*$/;

export function findPlainCssImports(source, filePath) {
	const findings = [];
	const lines = source.split("\n");
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		// Cheap rejects first: comments and any query-suffixed specifier.
		const trimmed = line.trim();
		if (trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
		const match = PLAIN_CSS_IMPORT.exec(line);
		if (!match) continue;
		const specifier = match[1] ?? match[2];
		if (!specifier || specifier.includes("?")) continue;
		findings.push({ file: filePath, line: index + 1, specifier });
	}
	return findings;
}

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRECTORIES.has(entry)) continue;
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			walk(full, out);
			continue;
		}
		if (SOURCE_EXTENSIONS.some((ext) => entry.endsWith(ext))) out.push(full);
	}
	return out;
}

function main() {
	let files;
	try {
		files = walk(SCAN_ROOT);
	} catch {
		console.log("[check-css-import-delivery] OK: no packages directory to scan");
		return;
	}

	const violations = [];
	for (const file of files) {
		const rel = relative(ROOT, file);
		violations.push(
			...findPlainCssImports(readFileSync(file, "utf8"), rel),
		);
	}

	if (violations.length > 0) {
		console.error(
			`[check-css-import-delivery] Found ${violations.length} plain CSS import(s) in publishable packages`,
		);
		for (const violation of violations) {
			console.error(
				`- ${violation.file}:${violation.line}\n  import "${violation.specifier}" is extracted to an unreferenced dist stylesheet and never reaches the page.\n  Import it as text with ?raw and install it, or move the rules into the component's own <style> block.`,
			);
		}
		process.exit(1);
	}

	console.log(
		`[check-css-import-delivery] OK: scanned ${files.length} source file(s), no plain CSS imports`,
	);
}

if (import.meta.main) main();
