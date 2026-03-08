<svelte:options
	customElement={{
		tag: "pie-section-player-vertical",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			player: { type: "Object", reflect: false },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
		},
	}}
/>

<script lang="ts">
	import "./section-player-item-card-element.js";
	import "./section-player-passage-card-element.js";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import * as SectionPlayerLayoutScaffoldModule from "./shared/SectionPlayerLayoutScaffold.svelte";
	import type { Component } from "svelte";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import {
		EMPTY_COMPOSITION,
	} from "./shared/composition.js";
	import { createPlayerAction } from "./shared/player-action.js";
	import {
		type LayoutCompositionSnapshot,
		deriveLayoutCompositionSnapshot,
		getCompositionSnapshotFromEvent,
	} from "./shared/section-player-view-state.js";
	import {
		resolveSectionPlayerRuntimeState,
		type RuntimeConfig,
	} from "./shared/section-player-runtime.js";
	import {
		type SectionPlayerCardRenderContext,
	} from "./shared/section-player-card-context.js";
	import { coerceBooleanLike } from "./shared/section-player-props.js";

	const SectionPlayerLayoutScaffold = (
		SectionPlayerLayoutScaffoldModule as unknown as {
			default: Component<any, any, any>;
		}
	).default;

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		playerType,
		player,
		lazyInit,
		tools,
		accessibility,
		coordinator,
		createSectionController,
		isolation,
		env,
		iifeBundleHost,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
	} = $props();

	let compositionSnapshot = $state<LayoutCompositionSnapshot>(
		deriveLayoutCompositionSnapshot(EMPTY_COMPOSITION),
	);
	let paneElementsLoaded = $state(false);

	const compositionModel = $derived(compositionSnapshot.compositionModel);
	const passages = $derived(compositionSnapshot.passages);
	const items = $derived(compositionSnapshot.items);
	const preloadedRenderables = $derived(compositionSnapshot.renderables);
	const preloadedRenderablesSignature = $derived(
		compositionSnapshot.renderablesSignature,
	);
	const runtimeState = $derived.by(() =>
		resolveSectionPlayerRuntimeState({
			assessmentId,
			playerType,
			player,
			lazyInit,
			tools,
			accessibility,
			coordinator,
			createSectionController,
			isolation,
			env,
			runtime,
			enabledTools,
			itemToolbarTools,
			passageToolbarTools,
		}),
	);
	const effectiveRuntime = $derived(runtimeState.effectiveRuntime);
	const playerRuntime = $derived(runtimeState.playerRuntime);
	const resolvedPlayerDefinition = $derived(playerRuntime.resolvedPlayerDefinition);
	const resolvedPlayerTag = $derived(playerRuntime.resolvedPlayerTag);
	const resolvedPlayerAttributes = $derived(playerRuntime.resolvedPlayerAttributes);
	const resolvedPlayerProps = $derived(playerRuntime.resolvedPlayerProps);
	const resolvedPlayerEnv = $derived(playerRuntime.resolvedPlayerEnv);
	const playerStrategy = $derived(playerRuntime.strategy);
	const verticalPlayerAction = createPlayerAction({
		stateKey: "__verticalAppliedParams",
		includeSessionRefInState: false,
	});
	const cardRenderContextValue = $derived.by(
		(): SectionPlayerCardRenderContext => ({
			resolvedPlayerTag,
			playerAction: verticalPlayerAction,
		}),
	);
	const normalizedShowToolbar = $derived(coerceBooleanLike(showToolbar, false));

	function handleBaseCompositionChanged(event: Event) {
		compositionSnapshot = getCompositionSnapshotFromEvent(event);
	}

	function handleItemsPaneElementsLoaded(event: Event) {
		const detail = (event as CustomEvent<{ elementsLoaded?: unknown }>).detail;
		paneElementsLoaded = detail?.elementsLoaded === true;
	}

	$effect(() => {
		resolvedPlayerDefinition?.ensureDefined?.().catch((error) => {
			console.error("[pie-section-player-vertical] Failed to load item player component:", error);
		});
	});

</script>

<SectionPlayerLayoutScaffold
	runtime={effectiveRuntime}
	{section}
	sectionId={sectionId}
	attemptId={attemptId}
	onCompositionChanged={handleBaseCompositionChanged}
	showToolbar={normalizedShowToolbar}
	toolbarPosition={toolbarPosition}
	enabledTools={enabledTools}
	cardRenderContext={cardRenderContextValue}
>
	<div class="pie-section-player-vertical-content">
		{#if passages.length > 0 && paneElementsLoaded}
			<section class="pie-section-player-passages-section" aria-label="Passages">
				<pie-section-player-passages-pane
					{passages}
					elementsLoaded={paneElementsLoaded}
					{resolvedPlayerEnv}
					{resolvedPlayerAttributes}
					{resolvedPlayerProps}
					playerStrategy={playerStrategy}
					passageToolbarTools={passageToolbarTools}
				></pie-section-player-passages-pane>
			</section>
		{/if}

		<section class="pie-section-player-items-section" aria-label="Items">
			<pie-section-player-items-pane
				{items}
				{compositionModel}
				{resolvedPlayerEnv}
				{resolvedPlayerAttributes}
				{resolvedPlayerProps}
				{playerStrategy}
				itemToolbarTools={itemToolbarTools}
				iifeBundleHost={iifeBundleHost}
				preloadedRenderables={preloadedRenderables}
				preloadedRenderablesSignature={preloadedRenderablesSignature}
				preloadComponentTag="pie-section-player-vertical"
				onelements-loaded-change={handleItemsPaneElementsLoaded}
			></pie-section-player-items-pane>
		</section>
	</div>
</SectionPlayerLayoutScaffold>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	.pie-section-player-vertical-content {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
	}

	.pie-section-player-passages-section,
	.pie-section-player-items-section {
		min-height: 0;
	}
</style>
