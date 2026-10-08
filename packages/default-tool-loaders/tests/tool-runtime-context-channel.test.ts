import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { AssessmentToolkitRuntimeContext } from "@pie-players/pie-assessment-toolkit";

/*
 * A tool reaches the toolkit's services through one channel: the runtime context
 * it connects to with `connectToolRuntimeContext`. An element prop carrying a
 * service, or a registration assigning one onto the element it creates, is the
 * second channel, and the two drift — a prop set at render goes stale when a
 * context republish brings a new coordinator. `providerId` is listed because a
 * tool finds its provider under its own tool id.
 */
const SERVICE_KEYS = [
	"toolkitCoordinator",
	"toolCoordinator",
	"ttsService",
	"highlightCoordinator",
	"catalogResolver",
	"elementToolStateStore",
] as const satisfies readonly (keyof AssessmentToolkitRuntimeContext)[];
const FORBIDDEN_KEYS = [...SERVICE_KEYS, "coordinator", "providerId"];

const PACKAGES_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SKIPPED_DIRS = new Set(["node_modules", "dist", "tests", ".svelte-kit"]);

function walk(dir: string, accept: (path: string) => boolean): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (SKIPPED_DIRS.has(entry)) continue;
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) files.push(...walk(path, accept));
		else if (accept(path)) files.push(path);
	}
	return files;
}

const toolPackageDirs = readdirSync(PACKAGES_ROOT)
	.filter((name) => name.startsWith("tool-"))
	.map((name) => join(PACKAGES_ROOT, name));

/** The text between `open` and its matching close brace. */
function braceBlock(source: string, open: number): string {
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		else if (source[i] === "}" && --depth === 0) {
			return source.slice(open, i + 1);
		}
	}
	return source.slice(open);
}

/** Whether `rest`, the text after a destructuring pattern, assigns `$props()`. */
function assignsProps(rest: string): boolean {
	let tail = rest.trimStart();
	if (tail.startsWith(":")) {
		tail = tail.slice(1).trimStart();
		if (tail.startsWith("{")) tail = tail.slice(braceBlock(tail, 0).length);
		else tail = tail.replace(/^[\w.$<>[\]|\s]+?(?=\s*=)/, "");
	}
	return /^\s*=\s*\$props\b/.test(tail);
}

/** The custom-element `props` block and every `let {…} = $props()` pattern. */
function declaredPropSpans(source: string): string[] {
	const spans: string[] = [];
	const ceProps = /customElement=\{\{[\s\S]*?\bprops:\s*\{/.exec(source);
	if (ceProps) {
		spans.push(braceBlock(source, ceProps.index + ceProps[0].length - 1));
	}
	for (const match of source.matchAll(/\blet\s*\{/g)) {
		const open = (match.index ?? 0) + match[0].length - 1;
		const block = braceBlock(source, open);
		if (assignsProps(source.slice(open + block.length))) spans.push(block);
	}
	return spans;
}

const keyPattern = (keys: readonly string[]) =>
	new RegExp(`\\b(${keys.join("|")})\\b`, "g");

/** `<expr>.<key> = …`, excluding `this.<key>` and comparisons. */
function elementAssignments(source: string): string[] {
	const pattern = new RegExp(
		`(?<!\\bthis)\\.(${FORBIDDEN_KEYS.join("|")})\\s*=(?![=>])`,
		"g",
	);
	return [...source.matchAll(pattern)].map((match) => match[1] ?? "");
}

describe("tools reach the toolkit through the runtime context only", () => {
	test("the scan reaches the tool packages", () => {
		// Positive control: an empty walk would pass every assertion below.
		const svelteFiles = toolPackageDirs.flatMap((dir) =>
			walk(dir, (path) => path.endsWith(".svelte")),
		);
		expect(toolPackageDirs.length).toBeGreaterThan(10);
		expect(svelteFiles.length).toBeGreaterThan(10);
		const answerEliminator = readFileSync(
			join(PACKAGES_ROOT, "tool-answer-eliminator/tool-answer-eliminator.svelte"),
			"utf8",
		);
		const spans = declaredPropSpans(answerEliminator);
		expect(spans.length).toBe(2);
		expect(spans.every((span) => span.includes("globalElementId"))).toBe(true);
	});

	test("the detectors flag a service prop and a service assignment", () => {
		const offending = `<svelte:options customElement={{ tag: 'x', props: { ttsService: { type: 'Object' } } }} />
<script lang="ts">
	let { toolkitCoordinator = null }: { toolkitCoordinator?: unknown } = $props();
	let { ttsService } = runtime;
	let { catalogResolver }: Props = $props();
</script>`;
		const found = declaredPropSpans(offending).flatMap((span) =>
			span.match(keyPattern(FORBIDDEN_KEYS)) ?? [],
		);
		// The destructure of a plain object is not a prop declaration.
		expect(found.sort()).toEqual([
			"catalogResolver",
			"toolkitCoordinator",
			"ttsService",
		]);
		expect(
			elementAssignments(
				"element.ttsService = services.ttsService;\nthis.ttsService = x;\nif (a.providerId === b) {}",
			),
		).toEqual(["ttsService"]);
	});

	test("no tool element declares a service prop", () => {
		const offenders: string[] = [];
		for (const dir of toolPackageDirs) {
			for (const path of walk(dir, (file) => file.endsWith(".svelte"))) {
				const source = readFileSync(path, "utf8");
				for (const span of declaredPropSpans(source)) {
					for (const key of new Set(span.match(keyPattern(FORBIDDEN_KEYS)))) {
						offenders.push(`${relative(PACKAGES_ROOT, path)}: ${key}`);
					}
				}
			}
		}
		expect(offenders).toEqual([]);
	});

	test("no registration hands a service to the element it creates", () => {
		const sources = [
			...walk(join(PACKAGES_ROOT, "default-tool-loaders/src"), (path) =>
				path.endsWith(".ts"),
			),
			...toolPackageDirs.flatMap((dir) =>
				walk(dir, (path) => path.endsWith(".ts") && !path.endsWith(".d.ts")),
			),
		];
		expect(sources.length).toBeGreaterThan(20);
		const offenders = sources.flatMap((path) =>
			elementAssignments(readFileSync(path, "utf8")).map(
				(key) => `${relative(PACKAGES_ROOT, path)}: .${key} =`,
			),
		);
		expect(offenders).toEqual([]);
	});
});
