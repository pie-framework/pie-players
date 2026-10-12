#!/usr/bin/env bun
/**
 * Typechecks the TypeScript examples in the documentation against the packages'
 * sources, so an example that names a removed export, a renamed option or a
 * changed signature fails here instead of in a reader's editor.
 * `check:docs:imports` checks that each `@pie-players/*` specifier a doc names
 * exists; this checks what the examples import from them and do with it.
 *
 * The docs are those `scripts/lib/markdown-docs.mjs` defines, except PRDs, whose
 * examples propose API that does not exist yet. A ```ts or ```typescript fence
 * that imports from `@pie-players/*` is a module and must typecheck. A fence
 * without such an import is skipped: whatever it uses from the packages is a
 * free name, which types as `any`, so it has nothing to check.
 *
 * `@pie-players/*` specifiers resolve to source through `workspaceExports`, the
 * map the unit tests resolve siblings with. An entry whose source is a Svelte
 * component or JavaScript resolves to the TypeScript source of its `types`
 * declarations; without one it has types only in its build, so it is declared an
 * untyped module and what an example imports from it is `any`. Build output is
 * never read, so the check gives one answer with or without a build. The check
 * is non-strict, since null checks and implicit `any` would only lengthen an
 * example, and only diagnostics in the examples are reported.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import {
	REPO_ROOT,
	workspaceExports,
	workspacePackages,
} from "../test-support/workspace-sources.ts";
import { markdownDocs } from "./lib/markdown-docs.mjs";

const EXCLUDED_DIRS = ["docs/prds/"];

const FENCE_OPEN = /^(\s*)```(?:ts|typescript)(?:\s.*)?$/;
const IMPORTS_PACKAGE = /(?:\bfrom|\bimport)\s*\(?\s*["']@pie-players\//;

/**
 * "Cannot find name" in its forms: a name the example uses without declaring
 * it, such as the element or coordinator an earlier example made. The checker
 * types it as `any`, so the rest of the example is still checked.
 */
const FREE_NAME_CODES = new Set([2304, 2552, 2582, 2593, 2662, 2663, 18004]);

/**
 * "Cannot find module", reported only for `@pie-players/*` specifiers. Any other
 * module, such as an element package or the reader's own `package.json`, is not
 * in this workspace and types as `any`.
 */
const CANNOT_FIND_MODULE = 2307;

/**
 * The players publish no tag map, so a property an example sets on an element
 * it looked up (`player.runtime = …`) would not exist on `Element`. This makes
 * such properties `any`.
 */
const AMBIENT_FILE = "doc-examples-ambient.d.ts";
const ELEMENT_PROPERTIES = "interface Element {\n\t[property: string]: any;\n}";

/** Sources the checker reads types from. */
const TYPED_SOURCE = /\.(?:ts|json)$/;

const SOURCE_SKIP_DIRS = new Set(["node_modules", "dist", ".svelte-kit"]);

/** The docs whose examples are checked. */
export function docFiles(root = REPO_ROOT) {
	return markdownDocs(root).filter((file) => {
		const relative = path.relative(root, file).replaceAll(path.sep, "/");
		return !EXCLUDED_DIRS.some((dir) => relative.startsWith(dir));
	});
}

/** The TypeScript fences in a markdown document, with their 1-based first code line. */
export function extractFences(markdown) {
	const lines = markdown.split("\n");
	const fences = [];
	for (let i = 0; i < lines.length; i += 1) {
		const open = FENCE_OPEN.exec(lines[i]);
		if (!open) continue;
		const indent = open[1];
		const body = [];
		let j = i + 1;
		for (; j < lines.length; j += 1) {
			if (lines[j].trim() === "```") break;
			body.push(
				lines[j].startsWith(indent) ? lines[j].slice(indent.length) : lines[j],
			);
		}
		fences.push({ line: i + 2, code: body.join("\n") });
		i = j;
	}
	return fences;
}

/** Ambient declarations the packages' sources rely on, such as `*.svelte` modules. */
function ambientDeclarations(root) {
	const found = [];
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!SOURCE_SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name));
			} else if (entry.name.endsWith(".d.ts")) {
				found.push(path.join(dir, entry.name));
			}
		}
	};
	for (const { dir } of workspacePackages(root)) {
		if (path.relative(root, path.dirname(dir)) !== "packages") continue;
		const src = path.join(dir, "src");
		if (existsSync(src)) walk(src);
		for (const entry of readdirSync(dir)) {
			if (entry.endsWith(".d.ts")) found.push(path.join(dir, entry));
		}
	}
	return found;
}

/**
 * Typechecks the examples in `files`. Returns how many were checked and skipped,
 * and one line per diagnostic, `<doc>:<line>: TS<code> <message>`.
 */
export function checkDocExamples(files, root = REPO_ROOT) {
	const paths = {};
	const untyped = [];
	for (const { specifier, source, typesSource } of workspaceExports(root)) {
		const typed = TYPED_SOURCE.test(source) ? source : typesSource;
		if (typed) paths[specifier] = [typed];
		else untyped.push(specifier);
	}
	const ambientText = [
		ELEMENT_PROPERTIES,
		...untyped.map((specifier) => `declare module "${specifier}";`),
	].join("\n");
	const virtual = new Map();
	const ambient = path.join(root, AMBIENT_FILE);
	let skipped = 0;
	for (const file of files) {
		const fences = extractFences(readFileSync(file, "utf8"));
		fences.forEach((fence, index) => {
			if (!IMPORTS_PACKAGE.test(fence.code)) {
				skipped += 1;
				return;
			}
			virtual.set(`${file}.example-${index + 1}.ts`, {
				doc: file,
				line: fence.line,
				text: `${fence.code}\nexport {};\n`,
			});
		});
	}

	const options = {
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.Preserve,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		lib: ["lib.esnext.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
		strict: false,
		noEmit: true,
		skipLibCheck: true,
		allowImportingTsExtensions: true,
		resolveJsonModule: true,
		types: [],
		baseUrl: root,
		paths,
	};
	const host = ts.createCompilerHost(options, true);
	const getSourceFile = host.getSourceFile.bind(host);
	host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
		const text =
			virtual.get(fileName)?.text ??
			(fileName === ambient ? ambientText : undefined);
		if (text !== undefined) {
			return ts.createSourceFile(fileName, text, languageVersion, true);
		}
		return getSourceFile(fileName, languageVersion, onError, shouldCreate);
	};
	const fileExists = host.fileExists.bind(host);
	host.fileExists = (fileName) =>
		virtual.has(fileName) || fileName === ambient || fileExists(fileName);
	const readFile = host.readFile.bind(host);
	host.readFile = (fileName) =>
		virtual.get(fileName)?.text ?? readFile(fileName);

	const program = ts.createProgram({
		rootNames: [...virtual.keys(), ambient, ...ambientDeclarations(root)],
		options,
		host,
	});
	const failures = [];
	for (const [name, { doc, line }] of virtual) {
		const sourceFile = program.getSourceFile(name);
		const diagnostics = [
			...program.getSyntacticDiagnostics(sourceFile),
			...program.getSemanticDiagnostics(sourceFile),
		];
		for (const diagnostic of diagnostics) {
			if (FREE_NAME_CODES.has(diagnostic.code)) continue;
			if (
				diagnostic.code === CANNOT_FIND_MODULE &&
				!sourceFile.text
					.slice(diagnostic.start, diagnostic.start + diagnostic.length)
					.includes("@pie-players/")
			) {
				continue;
			}
			const { line: offset } = sourceFile.getLineAndCharacterOfPosition(
				diagnostic.start ?? 0,
			);
			const message = ts.flattenDiagnosticMessageText(
				diagnostic.messageText,
				" ",
			);
			failures.push(
				`${path.relative(root, doc)}:${line + offset}: TS${diagnostic.code} ${message}`,
			);
		}
	}
	return { checked: virtual.size, skipped, failures };
}

function main() {
	const files = docFiles();
	const { checked, skipped, failures } = checkDocExamples(files);
	if (failures.length > 0) {
		console.error(
			`[check-doc-examples] ${failures.length} type errors in documentation examples:`,
		);
		for (const failure of failures) console.error(`  ${failure}`);
		process.exitCode = 1;
		return;
	}
	console.log(
		`[check-doc-examples] ${checked} examples in ${files.length} docs typecheck (${skipped} without a package import skipped).`,
	);
}

if (import.meta.main) main();
