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
@component
A section-level toolbar: a `<pie-item-toolbar>` at level `section`, scoped to the section a host names in `section-id`, rendering the tools in `enabled-tools` plus any `hostButtons`. The enclosing toolkit's coordinator drives the personal needs profile inputs through its policy engine, so the toolbar resolves none of them itself.
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
		language = "",
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
	{position}
	{size}
	{language}
	{toolRegistry}
	{item}
	{hostButtons}
></pie-item-toolbar>
