import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { renderManifests } from "../custom-elements-manifest.mjs";
import {
	buildManifests,
	parseDocText,
	surfaceKeys,
} from "../lib/custom-elements-manifest.mjs";

const TOKENS = [
	{
		name: "--pie-text",
		owner: "@pie-players/pie-theme",
		scope: "canonical-semantic",
		status: "stable",
		fallbackPolicy: "Body text color.",
		definedIn: ["packages/theme/src/tokens.css"],
	},
	{
		name: "--pie-panel-gap",
		owner: "@pie-players/panel",
		scope: "component-public",
		status: "stable",
		fallbackPolicy: "Space between panel rows.",
		definedIn: ["packages/panel/src/Rows.svelte"],
	},
	{
		name: "--pie-orphan",
		owner: "@pie-players/panel",
		scope: "component-public",
		status: "stable",
		definedIn: ["packages/panel/src/Unused.svelte"],
	},
];

/** Writes `files` (relative path -> text or JSON value) under a fresh workspace. */
function fixture(files) {
	const root = mkdtempSync(path.join(tmpdir(), "pie-ce-manifest-"));
	const all = {
		"package.json": { workspaces: ["packages/*"] },
		"packages/theme/src/token-registry.json": TOKENS,
		...files,
	};
	for (const [file, content] of Object.entries(all)) {
		mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
		writeFileSync(
			path.join(root, file),
			typeof content === "string" ? content : JSON.stringify(content),
		);
	}
	return root;
}

const packageJson = (name, exportsMap, extra = {}) => ({
	name,
	exports: Object.fromEntries(
		Object.entries(exportsMap).map(([subpath, target]) => [
			subpath,
			{ types: target.replace(/\.js$/, ".d.ts"), import: target },
		]),
	),
	customElements: "custom-elements.json",
	files: ["dist", "custom-elements.json"],
	...extra,
});

const PANEL = `<svelte:options
	customElement={{
		tag: "pie-panel",
		props: {
			/** Whether the panel starts open. */
			open: { type: "Boolean", reflect: true },
			itemCount: { attribute: "item-count", type: "Number" },
		},
	}}
/>

<!--
@component
A collapsible panel.

@fires {CustomEvent<{ open: boolean }>} toggle - When the panel opens or closes.
@slot - The panel body.
@slot heading - The panel heading.
-->

<script lang="ts">
	import Rows from "./Rows.svelte";

	let {
		open = false,
		itemCount = 0,
		/** The heading text. */
		label = "Panel",
	}: { open?: boolean; itemCount?: number; label?: string } = $props();

	/** Opens the panel. */
	export function show(): void {
		open = true;
		$host().dispatchEvent(new CustomEvent("toggle", { detail: { open } }));
	}
</script>

<section><slot name="heading"></slot><slot></slot><Rows /></section>
`;

const ROWS = `<script lang="ts">
	let { gap = 1 } = $props();
</script>
<div style="--pie-panel-gap: {gap}px"></div>
`;

const panelPackage = (panel = PANEL) => ({
	"packages/panel/package.json": packageJson("@pie-players/panel", {
		".": "./dist/index.js",
		"./panel-element": "./dist/panel-element.js",
	}),
	"packages/panel/src/index.ts": 'export { default as Panel } from "./Panel.svelte";',
	"packages/panel/src/panel-element.ts": 'import "./Panel.svelte";',
	"packages/panel/src/Panel.svelte": panel,
	"packages/panel/src/Rows.svelte": ROWS,
	"packages/panel/src/Unused.svelte": "<div></div>",
});

const declarationsOf = (manifest) =>
	manifest.modules.flatMap((module) => module.declarations);

describe("parseDocText", () => {
	test("separates the description from block tags", () => {
		const parsed = parseDocText(
			"A panel.\nSecond line.\n\n@fires {Event} close - When it closes.\n@slot - Body.",
		);
		expect(parsed.description).toBe("A panel.\nSecond line.");
	});
});

describe("buildManifests", () => {
	test("reads a Svelte element's props, methods and documented surface", () => {
		const root = fixture(panelPackage());
		const { manifests, problems, notices } = buildManifests(root);
		expect(problems).toEqual([]);
		expect(notices).toEqual(["--pie-orphan: no element renders the files that define it"]);

		const manifest = manifests.get("@pie-players/panel").manifest;
		expect(manifest.schemaVersion).toBe("2.1.0");
		const [element] = declarationsOf(manifest);
		expect(element).toMatchObject({
			kind: "class",
			name: "Panel",
			tagName: "pie-panel",
			customElement: true,
			description: "A collapsible panel.",
			events: [
				{
					name: "toggle",
					type: { text: "CustomEvent<{ open: boolean }>" },
					description: "When the panel opens or closes.",
				},
			],
			cssProperties: [{ name: "--pie-panel-gap", description: "Space between panel rows." }],
			"x-pie": { shadow: "open" },
		});
		expect(element.slots.map((slot) => slot.name)).toEqual(["", "heading"]);
		expect(element.attributes).toEqual([
			{
				name: "open",
				type: { text: "boolean" },
				default: "false",
				description: "Whether the panel starts open.",
				fieldName: "open",
			},
			{ name: "item-count", type: { text: "number" }, default: "0", fieldName: "itemCount" },
			{
				name: "label",
				type: { text: "string" },
				default: '"Panel"',
				description: "The heading text.",
				fieldName: "label",
			},
		]);
		expect(element.members.find((member) => member.name === "open")).toMatchObject({
			kind: "field",
			type: { text: "boolean" },
			attribute: "open",
			reflects: true,
		});
		expect(element.members.find((member) => member.name === "show")).toMatchObject({
			kind: "method",
			description: "Opens the panel.",
			return: { type: { text: "void" } },
		});
	});

	test("declares an element once and references it from every module that registers it", () => {
		const root = fixture(panelPackage());
		const { manifests } = buildManifests(root);
		const modules = manifests.get("@pie-players/panel").manifest.modules;
		expect(modules.map((module) => module.path)).toEqual([
			"dist/index.js",
			"dist/panel-element.js",
		]);
		const [index, entry] = modules;
		expect(index.declarations.map((declaration) => declaration.tagName)).toEqual(["pie-panel"]);
		expect(index.exports).toEqual([
			{ kind: "custom-element-definition", name: "pie-panel", declaration: { name: "Panel" } },
		]);
		expect(entry.declarations).toEqual([]);
		expect(entry.exports).toEqual([
			{
				kind: "custom-element-definition",
				name: "pie-panel",
				declaration: { name: "Panel", module: "dist/index.js" },
			},
		]);
	});

	test("requires a description and documentation for every dispatched event and rendered slot", () => {
		const root = fixture(
			panelPackage(
				PANEL.replace(/<!--[\s\S]*?-->/, "<!-- @component\n@cssprop --pie-x - No.\n-->"),
			),
		);
		const { problems } = buildManifests(root);
		expect(problems).toEqual(
			expect.arrayContaining([
				expect.stringContaining("@cssprop"),
				"packages/panel/src/Panel.svelte: add a <!-- @component --> comment describing the element",
				'packages/panel/src/Panel.svelte: document slot "heading" with @slot',
				"packages/panel/src/Panel.svelte: document the default slot with @slot",
				'packages/panel/src/Panel.svelte: document event "toggle" with @fires',
			]),
		);
	});

	test("rejects documentation for a slot the element does not render", () => {
		const root = fixture(panelPackage(PANEL.replace('<slot name="heading"></slot>', "")));
		expect(buildManifests(root).problems).toEqual([
			"packages/panel/src/Panel.svelte: @slot heading is not rendered",
		]);
	});

	test("lists a light-DOM element's pie-* classes and rejects its slots", () => {
		const root = fixture({
			"packages/flat/package.json": packageJson("@pie-players/flat", {
				".": "./dist/flat.js",
			}),
			"packages/flat/flat.svelte": `<svelte:options customElement={{ tag: "pie-flat", shadow: "none" }} />
<!-- @component A flat element. -->
<script lang="ts">
	let { active = false } = $props();
</script>
<div class="pie-flat pie-flat__row {active ? 'pie-flat--active' : ''}" class:pie-flat--on={active}>
	<span class="plain"></span><slot></slot>
</div>
`,
		});
		const { manifests, problems } = buildManifests(root);
		const [element] = declarationsOf(manifests.get("@pie-players/flat").manifest);
		expect(element["x-pie"]).toEqual({
			shadow: "none",
			classes: ["pie-flat", "pie-flat--active", "pie-flat--on", "pie-flat__row"],
		});
		expect(problems).toContain(
			"packages/flat/flat.svelte: renders <slot> without a shadow root, where it does not project",
		);
	});

	test("reads a class element registered by a define helper", () => {
		const root = fixture({
			"packages/widget/package.json": packageJson("@pie-players/widget", {
				".": "./dist/index.js",
			}),
			"packages/widget/src/index.ts": `import { WidgetElement } from "./widget-element.js";

function defineOnce(tag: string, ctor: CustomElementConstructor) {
	if (!customElements.get(tag)) customElements.define(tag, ctor);
}

defineOnce("pie-widget", WidgetElement);
export { WidgetElement };
`,
			"packages/widget/src/widget-element.ts": `/**
 * A widget.
 *
 * @fires {Event} ready - When the widget has rendered.
 */
export class WidgetElement extends HTMLElement {
	static observedAttributes = ["item-id", "mode"];

	/** The item shown. */
	itemId = "";

	#secret = 1;

	/** Renders the widget again. */
	refresh(force?: boolean): Promise<void> {
		return Promise.resolve();
	}

	connectedCallback() {
		this.attachShadow({ mode: "open" });
		this.dispatchEvent(new Event("ready"));
	}
}
`,
		});
		const { manifests, problems } = buildManifests(root);
		expect(problems).toEqual([]);
		const module = manifests.get("@pie-players/widget").manifest.modules[0];
		const [element] = module.declarations;
		expect(element).toMatchObject({
			name: "WidgetElement",
			tagName: "pie-widget",
			description: "A widget.",
			superclass: { name: "HTMLElement" },
			attributes: [
				{ name: "item-id", type: { text: "string" }, description: "The item shown.", fieldName: "itemId" },
				{ name: "mode" },
			],
			events: [{ name: "ready", type: { text: "Event" }, description: "When the widget has rendered." }],
			"x-pie": { shadow: "open" },
		});
		expect(element.members.map((member) => member.name)).toEqual(["itemId", "refresh"]);
		expect(module.exports.map((entry) => entry.kind)).toEqual(["custom-element-definition", "js"]);
	});

	test("finds events dispatched from the template and through a class's own methods", () => {
		const root = fixture({
			"packages/dialog/package.json": packageJson("@pie-players/dialog", {
				".": "./dist/index.js",
			}),
			"packages/dialog/src/index.ts": `import "./Dialog.svelte";
import { NoticeElement } from "./notice-element.js";
customElements.define("pie-notice", NoticeElement);
`,
			"packages/dialog/src/Dialog.svelte": `<svelte:options customElement={{ tag: "pie-dialog" }} />
<!-- @component A dialog. -->
<script lang="ts">
	function emit(name: string) {
		$host().dispatchEvent(new CustomEvent(name));
	}
</script>
<button onclick={() => emit("close")}>Close</button>
<button onclick={() => $host().dispatchEvent(new CustomEvent("dismiss"))}>Dismiss</button>
`,
			"packages/dialog/src/notice-element.ts": `/** A notice. */
export class NoticeElement extends HTMLElement {
	private dispatch(name: string) {
		this.dispatchEvent(new CustomEvent(name));
	}
	#emit(name: string) {
		this.dispatch(name);
	}
	connectedCallback() {
		this.dispatch("shown");
		this.#emit("read");
	}
}
`,
		});
		expect(buildManifests(root).problems.sort()).toEqual([
			'packages/dialog/src/Dialog.svelte: document event "close" with @fires',
			'packages/dialog/src/Dialog.svelte: document event "dismiss" with @fires',
			'packages/dialog/src/notice-element.ts NoticeElement: document event "read" with @fires',
			'packages/dialog/src/notice-element.ts NoticeElement: document event "shown" with @fires',
		]);
	});

	test("gives the theme element the theme's tokens", () => {
		const root = fixture({
			"packages/theme/package.json": packageJson("@pie-players/pie-theme", {
				".": "./dist/index.js",
			}),
			"packages/theme/src/index.ts": `/** Applies a theme. */
export class PieThemeElement extends HTMLElement {}
customElements.define("pie-theme", PieThemeElement);
`,
		});
		const { manifests } = buildManifests(root);
		const [element] = declarationsOf(manifests.get("@pie-players/pie-theme").manifest);
		expect(element.cssProperties).toEqual([{ name: "--pie-text", description: "Body text color." }]);
		expect(element["x-pie"]).toEqual({ shadow: "none" });
	});
});

describe("renderManifests", () => {
	test("requires the package.json fields to match whether a package has elements", () => {
		const root = fixture({
			...panelPackage(),
			"packages/panel/package.json": {
				...packageJson("@pie-players/panel", {
					".": "./dist/index.js",
					"./panel-element": "./dist/panel-element.js",
				}),
				customElements: undefined,
				files: ["dist"],
			},
			"packages/plain/package.json": packageJson("@pie-players/plain", {
				".": "./dist/index.js",
			}),
			"packages/plain/src/index.ts": "export const value = 1;",
			"packages/plain/custom-elements.json": "{}",
		});
		const { files, problems } = renderManifests(root);
		expect(problems).toEqual([
			'@pie-players/panel: set "customElements": "custom-elements.json" in package.json',
			'@pie-players/panel: add "custom-elements.json" to package.json "files"',
			'@pie-players/plain: registers no custom element; drop "customElements" and its "files" entry',
		]);
		expect(files.get("@pie-players/plain").text).toBeUndefined();
		expect(files.get("@pie-players/panel").text).toEndWith("}\n");
	});
});

describe("surfaceKeys", () => {
	test("lists each surface fact with its type", () => {
		const root = fixture(panelPackage());
		const keys = surfaceKeys(buildManifests(root).manifests.get("@pie-players/panel").manifest);
		expect([...keys].sort()).toEqual([
			"<pie-panel>",
			"<pie-panel> attribute item-count: number",
			"<pie-panel> attribute label: string",
			"<pie-panel> attribute open: boolean",
			"<pie-panel> css-property --pie-panel-gap",
			"<pie-panel> event toggle: CustomEvent<{ open: boolean }>",
			"<pie-panel> method show(): void",
			"<pie-panel> property itemCount: number",
			"<pie-panel> property label: string",
			"<pie-panel> property open: boolean",
			"<pie-panel> slot ",
			"<pie-panel> slot heading",
		]);
	});
});
