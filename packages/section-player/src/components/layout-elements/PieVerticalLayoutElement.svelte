<svelte:options
	customElement={{
		tag: "pie-vertical-layout",
		shadow: "open",
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
	import VerticalLayout from "../layouts/VerticalLayout.svelte";

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

<VerticalLayout
	composition={
		composition as SectionCompositionModel
	}
	{env}
	{toolbarPosition}
	{showToolbar}
/>
