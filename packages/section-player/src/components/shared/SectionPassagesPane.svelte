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
			// Read for one thing only: which passage, if any, is a timed-media
			// section's stimulus. Absent or non-timed-media renders exactly as before.
			compositionModel: { attribute: "composition-model", type: "Object", reflect: false },
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
	import type { SectionCompositionModel } from "../../controllers/types.js";
	import {
		DEFAULT_SECTION_BASE_HEADING_LEVEL,
		getPassagePlayerParams,
		type HeadingLevel,
	} from "./section-player-view-state.js";
	import { useInterfaceI18n } from "./use-interface-i18n.svelte.js";

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
		compositionModel = null as SectionCompositionModel | null,
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
		compositionModel?: SectionCompositionModel | null;
	}>();

	let loadingCard = $state<HTMLDivElement | null>(null);
	const interfaceI18n = useInterfaceI18n(() => loadingCard);

	// The stimulus is the section's time source, so it holds position while other
	// passages scroll. Two consequences, both scoped to a section that has one: it
	// renders first, and it sticks. A section without a media stimulus keeps today's
	// authored order and no sticky rule — the addition is invisible by construction
	// rather than by care at each call site.
	const stimulusPassageId = $derived(
		compositionModel?.timedMedia?.stimulusRenderableId ?? "",
	);
	const orderedPassages = $derived.by(() => {
		if (!stimulusPassageId) return passages;
		const stimulus = passages.filter(
			(passage: PassageEntity) => passage.id === stimulusPassageId,
		);
		if (stimulus.length === 0) return passages;
		return [
			...stimulus,
			...passages.filter(
				(passage: PassageEntity) => passage.id !== stimulusPassageId,
			),
		];
	});
</script>

{#if !elementsLoaded}
	<div class="pie-section-player-content-card" bind:this={loadingCard}>
		<div
			class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
		>
			{interfaceI18n.t("player.loadingPassage")}
		</div>
	</div>
{:else}
	{#each orderedPassages as passage, passageIndex (passage.id || passageIndex)}
		<pie-section-player-passage-card
			{passage}
			{baseHeadingLevel}
			timedMediaStimulus={!!stimulusPassageId && passage.id === stimulusPassageId}
			class={
				!!stimulusPassageId && passage.id === stimulusPassageId
					? "pie-section-player-passages-pane__stimulus"
					: ""
			}
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

	/* The media stays reachable while a second passage scrolls under it. Sticky
	   rather than fixed so it still scrolls out of a pane too short to hold it,
	   which keeps the whole card reachable at 400% zoom (WCAG 1.4.10). */
	:global(pie-section-player-passage-card.pie-section-player-passages-pane__stimulus) {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--pie-background, #fff);
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
	}
</style>
