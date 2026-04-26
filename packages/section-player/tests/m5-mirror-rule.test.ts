import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * M5 mirror rule (CI guardrail).
 *
 * Locks the contract documented in
 * `packages/section-player/src/components/shared/section-player-runtime.ts`:
 *
 *   `kebab-attribute ↔ camelCaseProp ↔ runtime.<sameCamelCaseKey>`
 *
 * Every key in `RuntimeConfig` must be settable through:
 *
 *   1. The `runtime` object (canonical, highest precedence).
 *   2. A camelCase prop on at least one layout CE (tier-1 surface).
 *   3. When the prop has an HTML attribute mapping, the attribute name
 *      must match the camelCase-to-kebab conversion of the prop name.
 *
 * Documented exceptions (no runtime mirror, by design):
 *   - Identity surfaces (`section-id`, `attempt-id`, `section`,
 *     `assessmentId`): per-attempt host state. `assessmentId` does
 *     mirror because re-using a section across attempts is supported.
 *   - Layout-only shell knobs (`show-toolbar`, `toolbar-position`,
 *     `narrow-layout-breakpoint`, `split-pane-collapse-strategy`):
 *     layout-CE concerns; the resolver does not see them.
 *   - Deprecated aliases (`itemToolbarTools`, `passageToolbarTools`,
 *     `frameworkErrorHook`): kept as props for back-compat but absorbed
 *     at the CE boundary into a canonical surface.
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
 * Keys from `RuntimeConfig` (mirrored manually so the test is also a
 * tripwire on intent: every additive change to `RuntimeConfig` should
 * touch this list and force the developer to think about the mirror).
 */
const RUNTIME_CONFIG_KEYS = [
	"assessmentId",
	"playerType",
	"player",
	"lazyInit",
	"tools",
	"accessibility",
	"coordinator",
	"createSectionController",
	"isolation",
	"env",
	"toolConfigStrictness",
	"onFrameworkError",
	"onStageChange",
	"onLoadingComplete",
	"enabledTools",
	"toolRegistry",
	"policies",
	"hooks",
	"sectionHostButtons",
	"itemHostButtons",
	"passageHostButtons",
	"iifeBundleHost",
	"debug",
	"contentMaxWidthNoPassage",
	"contentMaxWidthWithPassage",
	"splitPaneMinRegionWidth",
] as const;

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
