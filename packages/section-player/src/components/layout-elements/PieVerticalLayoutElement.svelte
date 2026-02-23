<svelte:options
	customElement={{
		tag: "pie-vertical-layout",
		shadow: "none",
		props: {
			passages: { type: "Object" },
			items: { type: "Object" },
			itemSessions: { type: "Object" },
			player: { type: "String" },
			env: { type: "Object" },
			playerVersion: { type: "String", attribute: "player-version" },
			assessmentId: { type: "String", attribute: "assessment-id" },
			sectionId: { type: "String", attribute: "section-id" },
			toolkitCoordinator: { type: "Object", reflect: false },
			playerDefinitions: { type: "Object", reflect: false },
			onsessionchanged: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import type { ComponentDefinition } from "../../component-definitions.js";
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
	import VerticalLayout from "../layouts/VerticalLayout.svelte";

	let {
		passages = [] as PassageEntity[],
		items = [] as ItemEntity[],
		itemSessions = {},
		player = "",
		env = { mode: "gather", role: "student" } as {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		},
		playerVersion = "latest",
		assessmentId = "",
		sectionId = "",
		toolkitCoordinator = null,
		playerDefinitions = {} as Partial<Record<string, ComponentDefinition>>,
		onsessionchanged = undefined as ((itemId: string, session: any) => void) | undefined,
	} = $props();
</script>

<VerticalLayout
	{passages}
	{items}
	{itemSessions}
	{player}
	{env}
	{playerVersion}
	{assessmentId}
	{sectionId}
	{toolkitCoordinator}
	{playerDefinitions}
	{onsessionchanged}
/>
