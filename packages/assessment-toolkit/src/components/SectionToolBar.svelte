<svelte:options
	customElement={{
		tag: "pie-section-toolbar",
		shadow: "none",
		props: {
			enabledTools: { type: "String", attribute: "enabled-tools" },
			position: { type: "String", attribute: "position" },
			sectionId: { type: "String", attribute: "section-id" },
			size: { type: "String", attribute: "size" },
			language: { type: "String", attribute: "language" },
			toolRegistry: { type: "Object", reflect: false },
			pnpResolver: { type: "Object", reflect: false },
			assessment: { type: "Object", reflect: false },
			itemRef: { type: "Object", reflect: false },
			item: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "./item-toolbar-element.js";
	import type { ToolRegistry } from "../services/ToolRegistry.js";
	import type { PNPToolResolver } from "../services/PNPToolResolver.js";
	import type { AssessmentEntity, AssessmentItemRef, ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { ToolbarItem } from "../services/toolbar-items.js";

	let {
		enabledTools = "",
		position = "bottom",
		sectionId = "",
		size = "md" as "sm" | "md" | "lg",
		language = "en-US",
		toolRegistry = null as ToolRegistry | null,
		pnpResolver = null as PNPToolResolver | null,
		assessment = null as AssessmentEntity | null,
		itemRef = null as AssessmentItemRef | null,
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
	{pnpResolver}
	{assessment}
	{itemRef}
	{item}
	{hostButtons}
></pie-item-toolbar>
