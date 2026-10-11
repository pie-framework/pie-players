<svelte:options
	customElement={{
		tag: "pie-section-player-passages-pane",
		// Keep light DOM so rendered passage content can inherit assessment/runtime styles.
		shadow: "none",
	}}
/>

<script lang="ts">
	import "../section-player-passage-card-element.js";
	import type { ToolbarItem } from "@pie-players/pie-assessment-toolkit";
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
	import {
		DEFAULT_SECTION_BASE_HEADING_LEVEL,
		getPassagePlayerParams,
	} from "./section-player-view-state.js";
	import {
		connectSectionPlayerLayoutContext,
		type SectionPlayerLayoutContext,
	} from "./section-player-layout-context.js";
	import { useInterfaceI18n } from "./use-interface-i18n.svelte.js";

	const NO_PASSAGES: PassageEntity[] = [];
	const NO_ENTRIES: Record<string, never> = {};
	const NO_BUTTONS: ToolbarItem[] = [];

	const paneHost = $host<HTMLElement>();
	let layout = $state.raw<SectionPlayerLayoutContext | null>(null);

	$effect(() =>
		connectSectionPlayerLayoutContext(paneHost, (value) => {
			layout = value;
		}),
	);

	// Through `$derived`, which keeps the function's identity across republishes,
	// so the pane registers once rather than once per layout value.
	const registerPane = $derived(layout?.registerPane ?? null);
	$effect(() => registerPane?.("passages", paneHost));

	// The one passages pane of this section player that renders.
	const active = $derived(layout?.activePanes.passages === paneHost);
	const passages = $derived(layout?.passages ?? NO_PASSAGES);
	const elementsLoaded = $derived(layout?.elementsLoaded === true);
	const resolvedPlayerEnv = $derived(layout?.resolvedPlayerEnv ?? NO_ENTRIES);
	const resolvedPlayerAttributes = $derived(
		layout?.resolvedPlayerAttributes ?? NO_ENTRIES,
	);
	const resolvedPlayerProps = $derived(layout?.resolvedPlayerProps ?? NO_ENTRIES);
	const playerStrategy = $derived(layout?.playerStrategy ?? "preloaded");
	const baseHeadingLevel = $derived(
		layout?.baseHeadingLevel ?? DEFAULT_SECTION_BASE_HEADING_LEVEL,
	);
	const passageToolbarTools = $derived(layout?.passageToolbarTools ?? "");
	const toolRegistry = $derived(layout?.toolRegistry ?? null);
	const hostButtons = $derived(layout?.passageHostButtons ?? NO_BUTTONS);
	// Read for one thing only: which passage, if any, is a timed-media section's
	// stimulus.
	const compositionModel = $derived(layout?.compositionModel ?? null);

	let loadingCard = $state<HTMLDivElement | null>(null);
	const interfaceI18n = useInterfaceI18n(() => loadingCard);

	// The stimulus is the section's time source, so it renders first. Ordering only:
	// pinning it in place needs `scroll-padding-top` on a scroll container this
	// component does not own, and a sticky card without that obscures a focused
	// control in a passage scrolling under it (WCAG 2.4.11). Placement belongs to a
	// timed-media layout — see Media Representation in the contract — and a section
	// with no media stimulus keeps today's authored order either way.
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

<!-- Empty for a section without passages, so a layout can keep the pane mounted
     for every section. -->
{#if active && passages.length > 0}
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
{/if}

<style>
	:global(pie-section-player-passages-pane) {
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
