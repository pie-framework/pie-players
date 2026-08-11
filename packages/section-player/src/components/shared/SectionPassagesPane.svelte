<svelte:options
	customElement={{
		tag: "pie-section-player-passages-pane",
		// Keep light DOM so rendered passage content can inherit assessment/runtime styles.
		shadow: "none",
		props: {
			passages: { type: "Object", reflect: false },
			elementsLoaded: { attribute: "elements-loaded", type: "Boolean" },
			resolvedPlayerEnv: { attribute: "resolved-player-env", type: "Object", reflect: false },
			resolvedPlayerAttributes: {
				attribute: "resolved-player-attributes",
				type: "Object",
				reflect: false,
			},
			resolvedPlayerProps: { attribute: "resolved-player-props", type: "Object", reflect: false },
			playerStrategy: { attribute: "player-strategy", type: "String" },
			baseHeadingLevel: { attribute: "base-heading-level", type: "Number" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "../section-player-passage-card-element.js";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
	import {
		DEFAULT_SECTION_BASE_HEADING_LEVEL,
		getPassagePlayerParams,
		type HeadingLevel,
	} from "./section-player-view-state.js";

	let {
		passages = [] as PassageEntity[],
		elementsLoaded = false,
		resolvedPlayerEnv = {} as Record<string, unknown>,
		resolvedPlayerAttributes = {} as Record<string, string>,
		resolvedPlayerProps = {} as Record<string, unknown>,
		playerStrategy = "preloaded",
		baseHeadingLevel = DEFAULT_SECTION_BASE_HEADING_LEVEL as HeadingLevel,
		passageToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
	} = $props<{
		passages: PassageEntity[];
		elementsLoaded: boolean;
		resolvedPlayerEnv: Record<string, unknown>;
		resolvedPlayerAttributes: Record<string, string>;
		resolvedPlayerProps: Record<string, unknown>;
		playerStrategy: string;
		baseHeadingLevel?: HeadingLevel;
		passageToolbarTools: string;
		toolRegistry?: ToolRegistry | null;
		hostButtons?: ToolbarItem[];
	}>();
</script>

{#if !elementsLoaded}
	<div class="pie-section-player-content-card">
		<div
			class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
		>
			Loading passage content...
		</div>
	</div>
{:else}
	{#each passages as passage, passageIndex (passage.id || passageIndex)}
		<pie-section-player-passage-card
			{passage}
			{baseHeadingLevel}
			playerParams={getPassagePlayerParams({
				passage,
				resolvedPlayerEnv,
				resolvedPlayerAttributes,
				resolvedPlayerProps,
				playerStrategy,
				baseHeadingLevel,
			})}
			passageToolbarTools={passageToolbarTools}
			{toolRegistry}
			{hostButtons}
		></pie-section-player-passage-card>
	{/each}
{/if}

<style>
	:host {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		min-width: 0;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
	}
</style>
