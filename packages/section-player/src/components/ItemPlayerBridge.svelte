<script lang="ts">
	import type { ComponentDefinition } from "../component-definitions.js";
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
	import { onMount, untrack } from "svelte";

	let {
		item,
		env,
		session,
		hasElements,
		resolvedPlayerTag,
		resolvedPlayerDefinition,
		skipElementLoading = true,
		onsessionchanged,
	}: {
		item: ItemEntity | PassageEntity;
		env: {
			mode: "gather" | "view" | "evaluate" | "author";
			role: "student" | "instructor";
		};
		session: any;
		hasElements: boolean;
		resolvedPlayerTag: string;
		resolvedPlayerDefinition?: ComponentDefinition;
		skipElementLoading?: boolean;
		onsessionchanged?: (event: CustomEvent) => void;
	} = $props();

	let playerElement: any = $state(null);
	let lastConfig: any = null;
	let lastEnv: any = null;

	onMount(() => {
		(async () => {
			if (hasElements) {
				await resolvedPlayerDefinition?.ensureDefined?.();
			}
		})();
	});

	$effect(() => {
		const currentConfig = item.config;
		const currentEnv = env;
		const currentSession = session;

		if (!playerElement || !currentConfig || !hasElements) return;

		const envChanged =
			!lastEnv ||
			lastEnv.mode !== currentEnv.mode ||
			lastEnv.role !== currentEnv.role;
		if (currentConfig === lastConfig && !envChanged) return;

		untrack(() => {
			playerElement.config = currentConfig;
			playerElement.session = currentSession;
			playerElement.env = currentEnv;
			if (resolvedPlayerDefinition?.attributes) {
				for (const [name, value] of Object.entries(
					resolvedPlayerDefinition.attributes,
				)) {
					playerElement.setAttribute(name, value);
				}
			}
			if (resolvedPlayerDefinition?.props) {
				for (const [name, value] of Object.entries(resolvedPlayerDefinition.props)) {
					(playerElement as any)[name] = value;
				}
			}
			if (skipElementLoading) {
				playerElement.setAttribute("skip-element-loading", "true");
				(playerElement as any).skipElementLoading = true;
			}
		});

		lastConfig = currentConfig;
		lastEnv = currentEnv;
	});

	$effect(() => {
		if (!playerElement || !onsessionchanged) return;

		const handler = (event: Event) => {
			onsessionchanged(event as CustomEvent);
		};

		playerElement.addEventListener("session-changed", handler);
		return () => {
			playerElement.removeEventListener("session-changed", handler);
		};
	});
</script>

{#if hasElements}
	{#key resolvedPlayerTag}
		<svelte:element this={resolvedPlayerTag} bind:this={playerElement}></svelte:element>
	{/key}
{:else}
	{@html item.config.markup}
{/if}
