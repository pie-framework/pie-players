#!/usr/bin/env node

/**
 * `check-speech-composition-purity` (PIE-623).
 *
 * Enforces the layered-architecture purity constraint for the generated-speech
 * core. Every `.ts` file under
 *   - `packages/assessment-toolkit/src/services/tts/generated-speech/`
 * EXCEPT the DOM adapter subtree
 *   - `packages/assessment-toolkit/src/services/tts/generated-speech/dom/`
 * must be pure speech-composition logic:
 *   - no imports from `svelte` (or `svelte/*`);
 *   - no imports from any path that resolves to a `.svelte` file;
 *   - no imports from `TTSService` (the runtime is downstream of the core);
 *   - no imports from `HighlightCoordinator` (rendering is a runtime concern);
 *   - no imports from the `highlight-pipeline` renderer/plan;
 *   - no imports from `@pie-players/pie-section-player*` (wrong direction).
 *
 * The pure core (plan assembly, SRE memoization, plan/segment types, and the
 * future SSML serializer) stays DOM-walk-free and runtime-free so it can be
 * reused from non-Svelte hosts (Node tests, a future authoring/persistable
 * path) and so SSML serialization never depends on the live DOM. Live-DOM
 * binding, alignment, and chunk emission live in `./dom/` (the adapter).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const CORE_DIR = path.join(
	ROOT,
	"packages",
	"assessment-toolkit",
	"src",
	"services",
	"tts",
	"generated-speech",
);
const DOM_DIR = path.join(CORE_DIR, "dom");

const FORBIDDEN_IMPORT_RULES = [
	{
		matches: (specifier) =>
			specifier === "svelte" || specifier.startsWith("svelte/"),
		reason: "imports from `svelte` (generated-speech core must be plain TS)",
	},
	{
		matches: (specifier) => /\.svelte(?:[?#]|$)/.test(specifier),
		reason: "imports from a `.svelte` source file",
	},
	{
		matches: (specifier) => specifier.includes("TTSService"),
		reason:
			"imports from `TTSService` (the runtime is downstream of the speech core)",
	},
	{
		matches: (specifier) => specifier.includes("HighlightCoordinator"),
		reason:
			"imports from `HighlightCoordinator` (rendering is a runtime concern)",
	},
	{
		matches: (specifier) => specifier.includes("highlight-pipeline"),
		reason:
			"imports from the `highlight-pipeline` renderer/plan (DOM-bound; belongs in ./dom/)",
	},
	{
		matches: (specifier) =>
			specifier.startsWith("@pie-players/pie-section-player"),
		reason:
			"imports from `@pie-players/pie-section-player*` (wrong dependency direction)",
	},
];

function listCoreTsFiles(dir) {
	const out = [];
	for (const entry of readdirSync(dir)) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			// The DOM adapter subtree is intentionally allowed DOM/renderer access.
			if (full === DOM_DIR) continue;
			out.push(...listCoreTsFiles(full));
			continue;
		}
		if (stat.isFile() && full.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function rel(p) {
	return path.relative(ROOT, p).replaceAll("\\", "/");
}

function stringLiteralValue(node) {
	return ts.isStringLiteralLike(node) ? node.text : null;
}

function collectModuleSpecifiers(sourceFile) {
	const specifiers = [];
	const addSpecifier = (node) => {
		const specifier = stringLiteralValue(node);
		if (!specifier) return;
		const { line, character } = sourceFile.getLineAndCharacterOfPosition(
			node.getStart(sourceFile),
		);
		specifiers.push({
			specifier,
			location: `${line + 1}:${character + 1}`,
		});
	};

	const visit = (node) => {
		if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
			addSpecifier(node.moduleSpecifier);
		} else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
			addSpecifier(node.moduleSpecifier);
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference)
		) {
			addSpecifier(node.moduleReference.expression);
		} else if (
			ts.isCallExpression(node) &&
			node.arguments.length === 1 &&
			(node.expression.kind === ts.SyntaxKind.ImportKeyword ||
				(ts.isIdentifier(node.expression) &&
					node.expression.text === "require"))
		) {
			addSpecifier(node.arguments[0]);
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return specifiers;
}

const violations = [];
const files = listCoreTsFiles(CORE_DIR);

for (const file of files) {
	// The barrel re-exports the DOM adapter as the module's public surface; it
	// is not core logic, so skip it. (Re-exports are not forbidden specifiers
	// anyway, but skipping keeps intent explicit.)
	if (file === path.join(CORE_DIR, "index.ts")) continue;
	const src = readFileSync(file, "utf8");
	const sourceFile = ts.createSourceFile(
		file,
		src,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	for (const { specifier, location } of collectModuleSpecifiers(sourceFile)) {
		for (const { matches, reason } of FORBIDDEN_IMPORT_RULES) {
			if (matches(specifier)) {
				violations.push({
					file: rel(file),
					location,
					specifier,
					reason,
				});
			}
		}
	}
}

if (violations.length > 0) {
	console.error(
		"[check-speech-composition-purity] purity violation(s) under packages/assessment-toolkit/src/services/tts/generated-speech/ (excluding dom/):",
	);
	for (const v of violations) {
		console.error(`  ${v.file}:${v.location}: "${v.specifier}" — ${v.reason}`);
	}
	console.error(
		"\nThe generated-speech core is pure speech-composition logic by design. " +
			"Move DOM walking, alignment, rendering, and runtime coupling into the " +
			"DOM adapter (generated-speech/dom/) or into TTSService itself.",
	);
	process.exit(1);
}

console.log(
	`[check-speech-composition-purity] OK: validated ${files.length} core file(s)`,
);
