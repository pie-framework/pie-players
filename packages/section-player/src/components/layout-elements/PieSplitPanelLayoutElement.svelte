<svelte:options
	customElement={{
		tag: "pie-split-panel-layout",
		shadow: "none",
		props: {
			passages: { type: "Object" },
			items: { type: "Object" },
			itemSessions: { type: "Object" },
			env: { type: "Object" },
			playerVersion: { type: "String", attribute: "player-version" },
			onsessionchanged: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
	import SplitPanelLayout from "../layouts/SplitPanelLayout.svelte";

	let {
		passages = [] as PassageEntity[],
		items = [] as ItemEntity[],
		itemSessions = {},
		env = { mode: "gather", role: "student" } as {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		},
		playerVersion = "latest",
		onsessionchanged = undefined as ((itemId: string, session: any) => void) | undefined,
	} = $props();
</script>

<SplitPanelLayout
	{passages}
	{items}
	{itemSessions}
	{env}
	{playerVersion}
	{onsessionchanged}
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
