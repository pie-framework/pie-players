import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeConfig } from "@pie-players/pie-assessment-toolkit/runtime/internal";

/**
 * M5 mirror rule (CI guardrail).
 *
 * Locks the contract whose canonical resolver lives in
 * `packages/assessment-toolkit/src/runtime/core/engine-resolver.ts`
 * (the `RuntimeConfig` type and the `resolveRuntime` /
 * `resolveToolsConfig` helpers). The contract is:
 *
 *   `kebab-attribute ↔ camelCaseProp ↔ runtime.<sameCamelCaseKey>`
 *
 * Every key in `RuntimeConfig` must:
 *
 *   1. Be settable through the `runtime` object (canonical, highest
 *      precedence).
 *   2. Be declared as a camelCase prop on at least one layout CE
 *      (tier-1 surface).
 *   3. When the prop has an HTML attribute mapping, the attribute name
 *      must match the camelCase-to-kebab conversion of the prop name.
 *   4. Be **read at the consumer site** as `runtime?.<key>` or
 *      `effectiveRuntime?.<key>` (or via `resolveOnFrameworkError(...)`
 *      for the M3 hook). Without this leg, a runtime-tier key is
 *      computed by `resolveRuntime` and silently discarded.
 *
 * Documented exceptions to the mirror rule (no `runtime.<key>`, by design):
 *   - Identity (`section-id`, `attempt-id`, `section`): per-attempt host
 *     state, not configuration.
 *   - Layout-only shell knobs (`show-toolbar`, `toolbar-position`,
 *     `narrow-layout-breakpoint`, `split-pane-collapse-strategy`,
 *     `content-max-width-no-passage`, `content-max-width-with-passage`,
 *     `split-pane-min-region-width`, `iife-bundle-host`, `debug`):
 *     layout-CE rendering / preload-host concerns.
 *   - Layout-shell host data (`policies`, `hooks`, `toolRegistry`,
 *     `sectionHostButtons`, `itemHostButtons`, `passageHostButtons`):
 *     consumed by the layout kernel through its top-level prop, not via
 *     `runtime`. Demoted from the M5 mirror in the follow-up trim.
 *   - Deprecated aliases (`itemToolbarTools`, `passageToolbarTools`):
 *     kept as props for back-compat but absorbed at the CE boundary into
 *     `tools.placement`.
 */

const PACKAGE_ROOT = resolve(__dirname, "..");

const LAYOUT_CE_FILES = [
	"src/components/PieSectionPlayerSplitPaneElement.svelte",
	"src/components/PieSectionPlayerVerticalElement.svelte",
	"src/components/PieSectionPlayerTabbedElement.svelte",
	"src/components/PieSectionPlayerKernelHostElement.svelte",
	"src/components/PieSectionPlayerBaseElement.svelte",
] as const;

/**
 * Keys derived from `RuntimeConfig` via an exhaustiveness sentinel: any
 * additive change to `RuntimeConfig` forces a corresponding edit here, and
 * any removal here without removing the type key fails type-check. This
 * keeps the test self-maintaining instead of relying on a hand-edited list
 * that could drift silently.
 *
 * Adding a key:
 *   - Add the key to `RuntimeConfig`.
 *   - Add the same key to `RUNTIME_CONFIG_KEYS_SENTINEL` below.
 *   - Wire a `runtime?.<key>` or `effectiveRuntime?.<key>` read at the
 *     consumer (or extend the documented-exceptions list above).
 */
const RUNTIME_CONFIG_KEYS_SENTINEL: Record<keyof RuntimeConfig, true> = {
	assessmentId: true,
	playerType: true,
	player: true,
	lazyInit: true,
	tools: true,
	accessibility: true,
	coordinator: true,
	createSectionController: true,
	isolation: true,
	env: true,
	toolConfigStrictness: true,
	onFrameworkError: true,
	onStageChange: true,
	onLoadingComplete: true,
	enabledTools: true,
};

const RUNTIME_CONFIG_KEYS = Object.keys(
	RUNTIME_CONFIG_KEYS_SENTINEL,
) as Array<keyof RuntimeConfig>;

type LayoutProp = {
	name: string;
	attribute?: string;
};

/**
 * Parse the `<svelte:options customElement={{ ... props: { ... } }}>`
 * block of a layout CE source file and return the declared props.
 *
 * Walks the `props: { ... }` block with balanced-brace tracking so
 * single-line entries (`runtime: { type: "Object" }`) and multi-line
 * entries (with optional `attribute:` field) are both handled. Layout
 * CE source files in this repo all follow the same `<svelte:options>`
 * shape, so a strict bracket-matching parser is enough — anything
 * more elaborate would just hide a real authoring drift.
 */
function parseLayoutProps(filePath: string): LayoutProp[] {
	const source = readFileSync(filePath, "utf8");
	const propsKeyIdx = source.indexOf("props:");
	if (propsKeyIdx === -1) {
		throw new Error(
			`Failed to locate \`props:\` key in ${filePath}; mirror-rule test parser needs an update.`,
		);
	}
	const openBraceIdx = source.indexOf("{", propsKeyIdx);
	if (openBraceIdx === -1) {
		throw new Error(
			`Failed to locate opening brace for \`props:\` in ${filePath}.`,
		);
	}
	let depth = 1;
	let cursor = openBraceIdx + 1;
	while (cursor < source.length && depth > 0) {
		const ch = source[cursor];
		if (ch === "{") depth += 1;
		else if (ch === "}") depth -= 1;
		if (depth === 0) break;
		cursor += 1;
	}
	if (depth !== 0) {
		throw new Error(`Unbalanced braces in props block of ${filePath}.`);
	}
	const block = source.slice(openBraceIdx + 1, cursor);

	const result: LayoutProp[] = [];
	let i = 0;
	while (i < block.length) {
		while (i < block.length && /\s|,|\/|\n/.test(block[i])) {
			if (block.slice(i, i + 2) === "//") {
				const eol = block.indexOf("\n", i);
				i = eol === -1 ? block.length : eol + 1;
				continue;
			}
			i += 1;
		}
		if (i >= block.length) break;
		const nameStart = i;
		while (i < block.length && /[a-zA-Z0-9_]/.test(block[i])) i += 1;
		const name = block.slice(nameStart, i);
		if (!name) break;
		while (i < block.length && /\s/.test(block[i])) i += 1;
		if (block[i] !== ":") break;
		i += 1;
		while (i < block.length && /\s/.test(block[i])) i += 1;
		if (block[i] !== "{") break;
		const valueStart = i;
		let valueDepth = 1;
		i += 1;
		while (i < block.length && valueDepth > 0) {
			const ch = block[i];
			if (ch === "{") valueDepth += 1;
			else if (ch === "}") valueDepth -= 1;
			i += 1;
		}
		const inner = block.slice(valueStart + 1, i - 1);
		const attrMatch = inner.match(/attribute:\s*"([^"]+)"/);
		result.push({
			name,
			attribute: attrMatch ? attrMatch[1] : undefined,
		});
	}
	return result;
}

function camelToKebab(name: string): string {
	return name.replace(/[A-Z]/g, (ch, idx) =>
		idx === 0 ? ch.toLowerCase() : `-${ch.toLowerCase()}`,
	);
}

/**
 * Strip `/* … *\/` block comments and `// …` line comments from a
 * source buffer. Used by `readAllPackageSource` so the
 * `CONSUMER_HELPER_MARKERS` substring scan cannot be satisfied by
 * comment text (which would let stale prose silently mask a real
 * regression in the consumer-leg leg of the M5 mirror).
 *
 * The strip is intentionally simple: it does not attempt to track
 * string literals or template literals. That is fine for this scan
 * because the markers are call-shaped (`resolveOnFrameworkError({`,
 * `resolveSectionEngineRuntimeState(args,`) and would not appear
 * inside a runtime-relevant string literal.
 */
function stripComments(source: string): string {
	const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, "");
	return withoutBlocks
		.split("\n")
		.map((line) => {
			const trimmed = line.trimStart();
			if (trimmed.startsWith("//")) return "";
			if (trimmed.startsWith("*")) return "";
			return line;
		})
		.join("\n");
}

/**
 * Walk `src/` and return concatenated, comment-stripped source text
 * for every `.ts` / `.svelte` file. Used by the consumer-leg test to
 * scan for `runtime?.<key>` / `effectiveRuntime?.<key>` reads (and the
 * dedicated-helper markers). Stripping comments closes a footgun
 * where a stale prose mention of a helper call could falsely satisfy
 * the marker after the actual call site moved or was inlined.
 */
function readAllPackageSource(): string {
	const root = resolve(PACKAGE_ROOT, "src");
	const buffers: string[] = [];
	const stack: string[] = [root];
	while (stack.length > 0) {
		const current = stack.pop() as string;
		const entries = readdirSync(current);
		for (const entry of entries) {
			const full = resolve(current, entry);
			const stats = statSync(full);
			if (stats.isDirectory()) {
				stack.push(full);
				continue;
			}
			if (!/\.(ts|svelte)$/.test(entry)) continue;
			buffers.push(stripComments(readFileSync(full, "utf8")));
		}
	}
	return buffers.join("\n");
}

const allPackageSource = readAllPackageSource();

/**
 * Keys whose runtime-tier consumption is not a literal `runtime?.<key>`
 * read but is wired through a dedicated resolver helper. Each entry maps
 * the `RuntimeConfig` key to a unique source-text marker that proves the
 * runtime tier is honored at the consumer.
 *
 * Post M7 PR 7: `enabledTools` is honored inside the toolkit-side
 * `resolveSectionEngineRuntimeState` orchestrator — section-player no
 * longer holds a literal `runtime?.enabledTools` read of its own. The
 * marker proves the kernel's host-runtime wrapper still funnels through
 * that orchestrator (which is itself locked by the engine-resolver
 * tests in the toolkit suite).
 */
const CONSUMER_HELPER_MARKERS: Partial<Record<keyof RuntimeConfig, string>> = {
	onFrameworkError: "resolveOnFrameworkError({",
	enabledTools: "resolveSectionEngineRuntimeState(args,",
};

const layoutsByFile = LAYOUT_CE_FILES.map((rel) => ({
	file: rel,
	props: parseLayoutProps(resolve(PACKAGE_ROOT, rel)),
}));

const allDeclaredPropNames = new Set<string>();
for (const layout of layoutsByFile) {
	for (const prop of layout.props) {
		allDeclaredPropNames.add(prop.name);
	}
}

describe("M5 mirror rule — RuntimeConfig coverage", () => {
	for (const key of RUNTIME_CONFIG_KEYS) {
		test(`RuntimeConfig key \`${key}\` is declared as a prop on at least one layout CE`, () => {
			expect(allDeclaredPropNames.has(key)).toBe(true);
		});
	}
});

describe("M5 mirror rule — kebab attribute matches camelCase prop", () => {
	for (const layout of layoutsByFile) {
		for (const prop of layout.props) {
			if (!prop.attribute) continue;
			const expected = camelToKebab(prop.name);
			test(`${layout.file}: prop \`${prop.name}\` has attribute \`${expected}\``, () => {
				expect(prop.attribute).toBe(expected);
			});
		}
	}
});

describe("M5 mirror rule — runtime field is canonical", () => {
	for (const layout of layoutsByFile) {
		test(`${layout.file} declares the \`runtime\` prop`, () => {
			const found = layout.props.find((p) => p.name === "runtime");
			expect(found).toBeDefined();
		});
	}
});

describe("M5 mirror rule — runtime tier is read by the consumer", () => {
	for (const key of RUNTIME_CONFIG_KEYS) {
		test(`RuntimeConfig key \`${key}\` is consumed via \`runtime?.${key}\` / \`effectiveRuntime?.${key}\` (or a dedicated resolver helper)`, () => {
			const helperMarker = CONSUMER_HELPER_MARKERS[key];
			if (helperMarker) {
				expect(allPackageSource.includes(helperMarker)).toBe(true);
				return;
			}
			const directRead = `runtime?.${key}`;
			const effectiveRead = `effectiveRuntime?.${key}`;
			const dotEffectiveRead = `effectiveRuntime.${key}`;
			expect(
				allPackageSource.includes(directRead) ||
					allPackageSource.includes(effectiveRead) ||
					allPackageSource.includes(dotEffectiveRead),
			).toBe(true);
		});
	}
});

/**
 * Nested mirror chain for `runtime.tools.qtiEnforcement` (M8 PR 4).
 *
 * `qtiEnforcement` is not a top-level `RuntimeConfig` key — it lives
 * under `runtime.tools`. The kebab/camelCase/runtime contract still
 * applies, but the surfaces are owned by `<pie-assessment-toolkit>`
 * (assessment-toolkit package), not by the section-player layout
 * shells. This block locks each leg of that nested chain so the
 * embedded path (`<pie-section-player-* runtime={{ tools: { ... } }}>`
 * → forwarded `tools` prop → toolkit reads `tools.qtiEnforcement`)
 * stays in sync with the standalone `qti-enforcement` attribute.
 */
const TOOLKIT_FILE = resolve(
	PACKAGE_ROOT,
	"..",
	"assessment-toolkit",
	"src",
	"components",
	"PieAssessmentToolkit.svelte",
);
const NORMALIZER_FILE = resolve(
	PACKAGE_ROOT,
	"..",
	"assessment-toolkit",
	"src",
	"services",
	"tools-config-normalizer.ts",
);
const toolkitSource = readFileSync(TOOLKIT_FILE, "utf8");
const toolkitProps = parseLayoutProps(TOOLKIT_FILE);
const normalizerSource = readFileSync(NORMALIZER_FILE, "utf8");
const sectionPlayerBaseSource = readFileSync(
	resolve(PACKAGE_ROOT, "src", "components", "PieSectionPlayerBaseElement.svelte"),
	"utf8",
);

describe("M5 mirror rule — runtime.tools.qtiEnforcement nested chain (M8 PR 4)", () => {
	test("`<pie-assessment-toolkit>` declares the `qtiEnforcement` prop with `attribute: \"qti-enforcement\"`", () => {
		const prop = toolkitProps.find((p) => p.name === "qtiEnforcement");
		expect(prop).toBeDefined();
		expect(prop?.attribute).toBe("qti-enforcement");
	});

	test("`CanonicalToolsConfig` declares `qtiEnforcement` so `runtime.tools.qtiEnforcement` is preserved through `normalizeToolsConfig`", () => {
		expect(normalizerSource.includes("qtiEnforcement?: ToolsQtiEnforcement")).toBe(
			true,
		);
		expect(normalizerSource.includes("config.qtiEnforcement = qtiEnforcement")).toBe(
			true,
		);
	});

	test("`<pie-assessment-toolkit>` falls back to `tools.qtiEnforcement` when the explicit prop is null (embedded `runtime.tools.qtiEnforcement` path)", () => {
		expect(
			toolkitSource.includes("resolveQtiEnforcementInput(qtiEnforcement, tools)"),
		).toBe(true);
		expect(
			toolkitSource.includes(`(toolsConfig as { qtiEnforcement?: unknown })`),
		).toBe(true);
	});

	test("`<pie-section-player-base>` forwards `runtime?.tools` through `effectiveTools` to `<pie-assessment-toolkit>`", () => {
		expect(
			sectionPlayerBaseSource.includes("const effectiveTools = $derived"),
		).toBe(true);
		expect(sectionPlayerBaseSource.includes("runtime?.tools ?? tools")).toBe(true);
		expect(sectionPlayerBaseSource.includes("tools={effectiveTools}")).toBe(true);
	});
});
