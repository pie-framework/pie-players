<svelte:options
	customElement={{
		tag: "pie-item-mode-layout",
		shadow: "open",
		props: {
			composition: { type: "Object" },
			env: { type: "Object" },
			toolbarPosition: { type: "String", attribute: "toolbar-position" },
			showToolbar: { type: "Boolean", attribute: "show-toolbar" },
			onnext: { type: "Object", reflect: false },
			onprevious: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import ItemModeLayout from "../ItemModeLayout.svelte";

	let {
		composition,
		env = { mode: "gather", role: "student" },
		toolbarPosition = "right",
		showToolbar = true,
		onnext = undefined as (() => void) | undefined,
		onprevious = undefined as (() => void) | undefined,
	}: {
		composition: SectionCompositionModel;
		env?: {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		};
		toolbarPosition?: "top" | "right" | "bottom" | "left" | "none";
		showToolbar?: boolean;
		onnext?: () => void;
		onprevious?: () => void;
	} = $props();
</script>

<ItemModeLayout
	composition={composition as SectionCompositionModel}
	{env}
	{toolbarPosition}
	{showToolbar}
	{onnext}
	{onprevious}
/>
