<svelte:options
	customElement={{
		tag: "pie-split-panel-layout",
		shadow: "none",
		props: {
			composition: { type: "Object" },
			env: { type: "Object" },
			toolbarPosition: { type: "String", attribute: "toolbar-position" },
			showToolbar: { type: "Boolean", attribute: "show-toolbar" },
		},
	}}
/>

<script lang="ts">
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import SplitPanelLayout from "../layouts/SplitPanelLayout.svelte";

	let {
		composition,
		env = { mode: "gather", role: "student" },
		toolbarPosition = "right",
		showToolbar = true,
	}: {
		composition: SectionCompositionModel;
		env?: {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		};
		toolbarPosition?: "top" | "right" | "bottom" | "left" | "none";
		showToolbar?: boolean;
	} = $props();
</script>

<SplitPanelLayout
	composition={
		composition as SectionCompositionModel
	}
	{env}
	{toolbarPosition}
	{showToolbar}
/>

<style>
	/* Ensure the custom-element wrapper is a constrained block container. */
	:global(pie-split-panel-layout) {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}
</style>
