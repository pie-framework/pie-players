#!/usr/bin/env bun
/**
 * Hardcoded learner-visible string scan — advisory, never gating.
 *
 * Scans the packages' Svelte templates with the real Svelte parser, which is
 * what makes the scope precise where the previous regex scan was not: a
 * string is a finding only where rendering is definitional —
 *
 * - template **text nodes** (a literal there is on screen by construction),
 * - **`aria-label`**, **`title`** and **`placeholder`** attributes carrying a
 *   static value (the accessible name and form-hint channels),
 *
 * while strings in `<script>` blocks — where a literal may equally be a
 * diagnostic — are out of scope, and any `{expression}` (an adopted
 * `t("…")` call) is invisible to the scan by definition. This is the
 * objection that kept the old scanner advisory with a bad conscience; the
 * answer is not a gate but a *scoped* warning the project can act on.
 *
 * Deliberate blind spots, each a precision trade:
 * - `apps/` is out of scope: the demo apps are reference assemblies, not the
 *   published surface the i18n contract governs.
 * - test and e2e directories are out of scope; tests may hardcode.
 * - attribute values mixing static text with an expression
 *   (`title="Graph {id}"`) are skipped — rare, and half-reporting them
 *   invites wrong fixes.
 * - component props named `title` are skipped: props are not DOM attributes.
 *
 * A finding names the string and, where the English catalog already carries
 * it, the key that should render instead. Exit code is always 0: this scan is
 * a warning report, run on demand (`bun run scan-hardcoded`) and weekly by
 * `.github/workflows/i18n-hardcoded-scan.yml`, which files the report on the
 * tracking issue with the `i18n-hardcoded-scan` label. Whether a finding is a
 * defect is a human call; the scan's job is to keep the list short and fresh.
 *
 * @module @pie-players/pie-players-shared/i18n/scripts/scan-hardcoded
 */

import { readFileSync } from "node:fs";
import { glob } from "glob";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";

const here = dirname(fileURLToPath(import.meta.url));

/** The monorepo root: the nearest ancestor carrying the workspaces manifest. */
function findProjectRoot(): string {
	let current = here;
	while (current !== dirname(current)) {
		try {
			const pkg = JSON.parse(readFileSync(resolve(current, "package.json"), "utf8"));
			if (pkg.workspaces) return current;
		} catch {
			// keep walking up
		}
		current = dirname(current);
	}
	throw new Error("Could not locate the repository root from the script location");
}

const projectRoot = findProjectRoot();

const SCANNED_ATTRIBUTES = new Set(["aria-label", "title", "placeholder"]);

/** A template text worth reporting: visible letters, not a lone glyph. */
function isLearnerVisibleText(data: string): boolean {
	const trimmed = data.trim();
	return trimmed.length > 0 && /[A-Za-z]{2}/.test(trimmed);
}

/** Collapse template whitespace so a finding reads as the rendered string. */
function collapse(data: string): string {
	return data.replace(/\s+/g, " ").trim();
}

interface Finding {
	file: string;
	line: number;
	kind: "text" | "attribute";
	attribute?: string;
	text: string;
	suggestedKey: string | null;
}

/** The English catalog flattened to `key → English value` for key hints. */
async function loadEnglishTranslations(): Promise<Record<string, string>> {
	const module = await import(resolve(here, "../messages/en-US.ts"));
	const translations: Record<string, string> = {};
	const pluralCategories = new Set([
		"zero",
		"one",
		"two",
		"few",
		"many",
		"other",
	]);
	const walk = (node: unknown, prefix: string) => {
		for (const [key, value] of Object.entries(node as object)) {
			const fullKey = prefix ? `${prefix}.${key}` : key;
			if (value !== null && typeof value === "object") {
				const keys = Object.keys(value);
				if (keys.length > 0 && keys.every((k) => pluralCategories.has(k))) {
					const group = value as Record<string, string>;
					translations[fullKey] = group.other ?? group.one;
				} else {
					walk(value, fullKey);
				}
			} else if (typeof value === "string") {
				translations[fullKey] = value;
			}
		}
	};
	walk(module.default, "");
	return translations;
}

function findTranslationKey(
	translations: Record<string, string>,
	searchValue: string,
): string | null {
	for (const [key, value] of Object.entries(translations)) {
		if (value === searchValue) return key;
	}
	const lower = searchValue.toLowerCase();
	for (const [key, value] of Object.entries(translations)) {
		if (value.toLowerCase() === lower) return key;
	}
	return null;
}

function lineOf(source: string, offset: number | undefined): number {
	if (typeof offset !== "number") return 1;
	let line = 1;
	for (let i = 0; i < offset && i < source.length; i++) {
		if (source[i] === "\n") line++;
	}
	return line;
}

/**
 * Walk a template fragment. Shape-tolerant rather than type-exhaustive: the
 * Svelte 5 AST names nodes differently across majors (`RegularElement` vs
 * `Element`, `ExpressionTag` vs `MustacheTag`), and the scan only needs three
 * behaviors — read text, read static attributes of real elements, descend
 * into whatever holds children.
 */
function walkTemplate(
	fragment: any,
	source: string,
	filePath: string,
	translations: Record<string, string>,
	findings: Finding[],
): void {
	const nodes: any[] = fragment?.nodes ?? fragment?.children ?? [];
	for (const node of nodes) {
		if (!node || typeof node !== "object") continue;
		if (node.type === "Script" || node.type === "Style") continue;

		if (node.type === "Text" && isLearnerVisibleText(node.data ?? "")) {
			findings.push({
				file: filePath,
				line: lineOf(source, node.start),
				kind: "text",
				text: collapse(node.data),
				suggestedKey: findTranslationKey(translations, collapse(node.data)),
			});
			continue;
		}

		// Attributes exist only on elements; a component prop named `title` is
		// a prop, not the DOM attribute the contract governs.
		const isElement =
			node.type === "RegularElement" || node.type === "Element";
		if (isElement && Array.isArray(node.attributes)) {
			for (const attribute of node.attributes) {
				if (
					typeof attribute?.name !== "string" ||
					!SCANNED_ATTRIBUTES.has(attribute.name) ||
					!Array.isArray(attribute.value) ||
					attribute.value.length !== 1 ||
					attribute.value[0]?.type !== "Text"
				) {
					continue;
				}
				const data = attribute.value[0].data ?? "";
				if (!isLearnerVisibleText(data)) continue;
				findings.push({
					file: filePath,
					line: lineOf(source, attribute.value[0].start ?? node.start),
					kind: "attribute",
					attribute: attribute.name,
					text: collapse(data),
					suggestedKey: findTranslationKey(translations, collapse(data)),
				});
			}
		}

		// Descend into whatever holds children: element fragments, block
		// fragments (`{#if}`, `{#each}`), component slot content.
		if (node.fragment) walkTemplate(node.fragment, source, filePath, translations, findings);
		if (Array.isArray(node.children)) {
			walkTemplate(
				{ nodes: node.children },
				source,
				filePath,
				translations,
				findings,
			);
		}
	}
}

async function main(): Promise<void> {
	const files = await glob(`${projectRoot}/packages/**/*.svelte`, {
		absolute: true,
		nodir: true,
	});
	const scannable = files.filter(
		(file) =>
			!file.includes("/node_modules/") &&
			!file.includes("/dist/") &&
			!file.includes("/.svelte-kit/") &&
			!file.includes("/build/") &&
			!file.includes("/test/") &&
			!file.includes("/tests/") &&
			!file.includes("/playwright/"),
	);

	const translations = await loadEnglishTranslations();
	const findings: Finding[] = [];
	let parseErrors = 0;

	for (const file of scannable) {
		const source = readFileSync(file, "utf8");
		try {
			// `modern` selects the current Svelte 5 AST where the compiler
			// supports the option; older shapes still walk via the fallbacks in
			// walkTemplate.
			const parsed = parse(source, {
				filename: file,
				// `modern` selects the current Svelte 5 AST where the compiler
				// supports the option; older shapes still walk via the fallbacks
				// in walkTemplate.
				modern: true,
			} as any);
			const root = (parsed as any).ast ?? parsed;
			const template = root.fragment ?? root.html ?? root;
			walkTemplate(template, source, file, translations, findings);
		} catch (error) {
			parseErrors += 1;
			console.error(`Could not parse ${relative(projectRoot, file)}: ${String(error)}`);
		}
	}

	const byPackage = new Map<string, Finding[]>();
	for (const finding of findings) {
		const rel = relative(projectRoot, finding.file);
		const pkg = rel.split("/").slice(0, 2).join("/");
		const list = byPackage.get(pkg) ?? [];
		list.push(finding);
		byPackage.set(pkg, list);
	}

	console.log("Hardcoded learner-visible string scan (advisory)");
	console.log(`Scanned ${scannable.length} Svelte templates under packages/.`);
	if (parseErrors > 0) {
		console.log(`${parseErrors} file(s) could not be parsed and were skipped.`);
	}
	console.log("");

	if (findings.length === 0) {
		console.log("No findings. Every template text and scanned attribute resolves through the catalog.");
		console.log("Hardcoded-string scan: 0 findings.");
		return;
	}

	for (const [pkg, list] of [...byPackage.entries()].sort()) {
		console.log(`${pkg} — ${list.length} finding(s)`);
		for (const finding of list) {
			const where = `${relative(projectRoot, finding.file)}:${finding.line}`;
			const channel = finding.kind === "attribute" ? `${finding.attribute}=` : "text";
			const hint = finding.suggestedKey
				? ` → use t("${finding.suggestedKey}")`
				: " → no catalog key carries this; add one to en-US.ts if it reaches a learner";
			console.log(`  ${where} ${channel}"${finding.text}"${hint}`);
		}
		console.log("");
	}

	console.log(
		`Findings are advisory: a human decides whether each reaches a learner. See the i18n README and the weekly i18n-hardcoded-scan workflow.`,
	);
	console.log(
		`Hardcoded-string scan: ${findings.length} findings in ${byPackage.size} package(s) (${scannable.length} scanned).`,
	);
}

await main();
