<svelte:options
	customElement={{
		tag: "pie-section-toolbar",
		shadow: "open",
		props: {
			enabledTools: { type: "String", attribute: "enabled-tools" },
			position: { type: "String", attribute: "position" },
			sectionId: { type: "String", attribute: "section-id" },
			size: { type: "String", attribute: "size" },
			language: { type: "String", attribute: "language" },
			toolRegistry: { type: "Object", reflect: false },
			item: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<!--
  SectionToolBar - Thin wrapper around `<pie-item-toolbar>` for
  section-level placement. As of M8 PR 3 the legacy `pnpResolver` /
  `assessment` / `itemRef` props are gone — the toolkit coordinator
  drives QTI inputs via its policy engine, so toolbars no longer
  need to resolve them locally.
-->
<script lang="ts">
	import "./item-toolbar-element.js";
	import type { ToolRegistry } from "../services/ToolRegistry.js";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { ToolbarItem } from "../services/toolbar-items.js";

	let {
		enabledTools = "",
		position = "bottom",
		sectionId = "",
		size = "md" as "sm" | "md" | "lg",
		language = "en-US",
		toolRegistry = null as ToolRegistry | null,
		item = null as ItemEntity | null,
		hostButtons = [] as ToolbarItem[],
	} = $props();
</script>

<pie-item-toolbar
	level="section"
	scope-id={sectionId}
	section-id={sectionId}
	tools={enabledTools}
	content-kind="section"
	position={position}
	{size}
	{language}
	{toolRegistry}
	{item}
	{hostButtons}
></pie-item-toolbar>
