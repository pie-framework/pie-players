<svelte:options
	customElement={{
		tag: "pie-vertical-layout",
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
	import VerticalLayout from "../layouts/VerticalLayout.svelte";

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

<VerticalLayout
	{passages}
	{items}
	{itemSessions}
	{env}
	{playerVersion}
	{onsessionchanged}
/>
