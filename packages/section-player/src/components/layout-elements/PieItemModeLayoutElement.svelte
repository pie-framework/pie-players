<svelte:options
	customElement={{
		tag: "pie-item-mode-layout",
		shadow: "none",
		props: {
			composition: { type: "Object" },
			env: { type: "Object" },
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
		onnext = undefined as (() => void) | undefined,
		onprevious = undefined as (() => void) | undefined,
	}: {
		composition: SectionCompositionModel;
		env?: {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		};
		onnext?: () => void;
		onprevious?: () => void;
	} = $props();
</script>

<ItemModeLayout
	composition={composition as SectionCompositionModel}
	{env}
	{onnext}
	{onprevious}
/>
