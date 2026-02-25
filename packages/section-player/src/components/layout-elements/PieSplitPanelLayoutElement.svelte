<svelte:options
	customElement={{
		tag: "pie-split-panel-layout",
		shadow: "none",
		props: {
			composition: { type: "Object" },
			env: { type: "Object" },
		},
	}}
/>

<script lang="ts">
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import SplitPanelLayout from "../layouts/SplitPanelLayout.svelte";

	let {
		composition,
		env = { mode: "gather", role: "student" },
	}: {
		composition: SectionCompositionModel;
		env?: {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		};
	} = $props();
</script>

<SplitPanelLayout
	composition={
		composition as SectionCompositionModel
	}
	{env}
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
