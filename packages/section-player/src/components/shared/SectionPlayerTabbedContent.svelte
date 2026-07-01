<script lang="ts">
	import { untrack } from "svelte";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";

	type LayoutModel = {
		passages: unknown[];
		items: unknown[];
		compositionModel: unknown;
		paneElementsLoaded: boolean;
		resolvedPlayerEnv: unknown;
		resolvedPlayerAttributes: unknown;
		resolvedPlayerProps: unknown;
		playerStrategy: unknown;
		preloadedRenderables: unknown;
		preloadedRenderablesSignature: string;
		toolRegistry: ToolRegistry | null;
		itemHostButtons: ToolbarItem[];
		passageHostButtons: ToolbarItem[];
		onItemsPaneElementsLoaded: (event: Event) => void;
		onItemsPanePreloadRetry: (event: Event) => void;
		onItemsPanePreloadError: (event: Event) => void;
	};

	type TabKey = "passage" | "items";

	let {
		layoutModel,
		itemToolbarTools = "",
		passageToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		iifeBundleHost,
		preloadComponentTag = "pie-section-player-tabbed",
		contentMaxWidthNoPassagePx = undefined as number | undefined,
		contentMaxWidthWithPassagePx = undefined as number | undefined,
		idBase = "pie-section-player-tabbed",
	} = $props<{
		layoutModel: LayoutModel;
		itemToolbarTools?: string;
		passageToolbarTools?: string;
		toolRegistry?: ToolRegistry | null;
		itemHostButtons?: ToolbarItem[];
		passageHostButtons?: ToolbarItem[];
		iifeBundleHost?: string;
		preloadComponentTag?: string;
		contentMaxWidthNoPassagePx?: number;
		contentMaxWidthWithPassagePx?: number;
		idBase?: string;
	}>();

	let activeTab = $state<TabKey>("passage");
	let passageTabButton = $state<HTMLButtonElement | null>(null);
	let itemsTabButton = $state<HTMLButtonElement | null>(null);

	/**
	 * Zoom compensation for the passage/questions toggle.
	 *
	 * The toggle scales naturally with browser zoom up to 200%. Beyond 200%,
	 * we shrink its CSS size proportionally so its physical on-screen size
	 * freezes at the 200% appearance, leaving more room for passage/question
	 * content in high-zoom / small-window situations.
	 *
	 * Browser zoom is approximated as outerWidth / innerWidth: outerWidth is
	 * the OS window size (zoom-independent) while innerWidth is in CSS pixels
	 * (shrinks as zoom increases). Zoom changes always fire a resize event,
	 * so listening to resize keeps the value current.
	 *
	 * The factor is min(1, 2 / zoom): exactly 1 at zoom <= 200% (component
	 * behavior unchanged), shrinking proportionally above that. A lower clamp
	 * of 0.4 guards against inflated ratios (docked devtools, browser side
	 * panels, window chrome) ever making the toggle unusably small.
	 *
	 * NOTE: this same factor is also applied to the vertical spacing
	 * (gap + block padding) surrounding the toggle in
	 * .pie-section-player-tabbed-content, via the same CSS variable. The
	 * `zoom` property only shrinks the toggle element itself; the flex gap
	 * and padding live outside that element and would otherwise keep
	 * growing with real browser zoom, silently eating back the vertical
	 * space this work is meant to reclaim.
	 */
	const MAX_TOGGLE_ZOOM = 2;
	const MIN_ZOOM_COMPENSATION = 0.4;

	let zoomCompensation = $state(1);

	function updateZoomCompensation() {
		const ratio = window.outerWidth / window.innerWidth;
		const zoom = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
		zoomCompensation = Math.max(
			MIN_ZOOM_COMPENSATION,
			Math.min(1, MAX_TOGGLE_ZOOM / zoom),
		);
	}

	$effect(() => {
		updateZoomCompensation();
		window.addEventListener("resize", updateZoomCompensation);
		return () => window.removeEventListener("resize", updateZoomCompensation);
	});

	// Reset to the Passage tab whenever we navigate to a different section.
	$effect(() => {
		void idBase;
		untrack(() => {
			activeTab = "passage";
		});
	});

	const hasPassages = $derived(layoutModel.passages.length > 0);
	const layoutMaxWidthPx = $derived(
		hasPassages ? contentMaxWidthWithPassagePx : contentMaxWidthNoPassagePx,
	);
	const passageTabId = $derived(`${idBase}-tab-passage`);
	const itemsTabId = $derived(`${idBase}-tab-items`);
	const passagePanelId = $derived(`${idBase}-panel-passage`);
	const itemsPanelId = $derived(`${idBase}-panel-items`);
	const selectedTab = $derived(hasPassages ? activeTab : "items");

	function setActiveTab(tab: TabKey) {
		if (tab === "passage" && !hasPassages) return;
		activeTab = tab;
	}

	function focusTab(tab: TabKey) {
		if (tab === "passage") {
			passageTabButton?.focus();
			return;
		}
		itemsTabButton?.focus();
	}

	function handleTabKeyDown(event: KeyboardEvent, tab: TabKey) {
		if (!hasPassages) return;
		switch (event.key) {
			case "ArrowRight":
			case "ArrowLeft": {
				event.preventDefault();
				const next = tab === "passage" ? "items" : "passage";
				setActiveTab(next);
				focusTab(next);
				break;
			}
			case "Home": {
				event.preventDefault();
				setActiveTab("passage");
				focusTab("passage");
				break;
			}
			case "End": {
				event.preventDefault();
				setActiveTab("items");
				focusTab("items");
				break;
			}
		}
	}
</script>

<div
	class="pie-section-player-tabbed-frame"
	style={`--pie-section-player-layout-max-width: ${
		layoutMaxWidthPx !== undefined ? `${layoutMaxWidthPx}px` : "none"
	}; --pie-section-player-tab-zoom-comp: ${zoomCompensation};`}
>
	<div class="pie-section-player-tabbed-content">
		{#if hasPassages}
			<div class="pie-section-player-tabs" role="tablist" aria-label="Section content tabs">
				<button
					bind:this={passageTabButton}
					id={passageTabId}
					type="button"
					role="tab"
					class={`pie-section-player-tab ${selectedTab === "passage" ? "pie-section-player-tab--active" : ""} passage-label`}
					data-pie-purpose="passage-label"
					aria-controls={passagePanelId}
					aria-selected={selectedTab === "passage"}
					tabindex={selectedTab === "passage" ? 0 : -1}
					onclick={() => setActiveTab("passage")}
					onkeydown={(event) => handleTabKeyDown(event, "passage")}
				>
					Passage
				</button>
				<button
					bind:this={itemsTabButton}
					id={itemsTabId}
					type="button"
					role="tab"
					class={`pie-section-player-tab ${selectedTab === "items" ? "pie-section-player-tab--active" : ""} item-label`}
					data-pie-purpose="item-label"
					aria-controls={itemsPanelId}
					aria-selected={selectedTab === "items"}
					tabindex={selectedTab === "items" ? 0 : -1}
					onclick={() => setActiveTab("items")}
					onkeydown={(event) => handleTabKeyDown(event, "items")}
				>
					Questions
				</button>
			</div>
		{/if}

		{#if hasPassages}
			<div
				id={passagePanelId}
				class="pie-section-player-tab-panel pie-section-player-tab-panel--passages"
				role="tabpanel"
				aria-labelledby={passageTabId}
				hidden={selectedTab !== "passage"}
			>
				<pie-section-player-passages-pane
					passages={layoutModel.passages}
					elementsLoaded={layoutModel.paneElementsLoaded}
					resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
					resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
					resolvedPlayerProps={layoutModel.resolvedPlayerProps}
					playerStrategy={layoutModel.playerStrategy}
					passageToolbarTools={passageToolbarTools}
					toolRegistry={toolRegistry || layoutModel.toolRegistry}
					hostButtons={
						passageHostButtons.length > 0
							? passageHostButtons
							: layoutModel.passageHostButtons
					}
				></pie-section-player-passages-pane>
			</div>
		{/if}

		<div
			id={itemsPanelId}
			class="pie-section-player-tab-panel pie-section-player-tab-panel--items"
			role="tabpanel"
			aria-labelledby={hasPassages ? itemsTabId : undefined}
			hidden={hasPassages && selectedTab !== "items"}
		>
			<pie-section-player-items-pane
				items={layoutModel.items}
				compositionModel={layoutModel.compositionModel}
				resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
				resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
				resolvedPlayerProps={layoutModel.resolvedPlayerProps}
				playerStrategy={layoutModel.playerStrategy}
				itemToolbarTools={itemToolbarTools}
				toolRegistry={toolRegistry || layoutModel.toolRegistry}
				hostButtons={
					itemHostButtons.length > 0 ? itemHostButtons : layoutModel.itemHostButtons
				}
				iifeBundleHost={iifeBundleHost}
				preloadedRenderables={layoutModel.preloadedRenderables}
				preloadedRenderablesSignature={layoutModel.preloadedRenderablesSignature}
				{preloadComponentTag}
				preloadEnabled={layoutModel.preloadEnabled}
				onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
				onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
				onelement-preload-error={layoutModel.onItemsPanePreloadError}
			></pie-section-player-items-pane>
		</div>
	</div>
</div>

<style>
	.pie-section-player-tabbed-frame {
		width: 100%;
		max-width: var(--pie-section-player-layout-max-width, none);
		height: 100%;
		min-height: 0;
		max-height: 100%;
		margin-inline: auto;
		overflow: hidden;
	}

	.pie-section-player-tabbed-content {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		/*
		 * The gap between the tab row and the panel below it sits OUTSIDE the
		 * zoomed .pie-section-player-tabs element, so it isn't shrunk by the
		 * `zoom` CSS property applied there. It must be compensated
		 * separately using the same factor, or it keeps growing with real
		 * browser zoom past 200% and eats back the space we're trying to
		 * reclaim.
		 */
		gap: calc(
			var(--pie-section-player-tab-gap, 0.5rem) *
				var(--pie-section-player-tab-zoom-comp, 1)
		);
		/*
		 * Likewise, vertical (block) padding around the whole content area
		 * contributes to the white space above/below the toggle and must be
		 * compensated. Horizontal (inline) padding is left alone since the
		 * goal is reclaiming vertical space for passage/question content,
		 * not narrowing the content column.
		 */
		padding-block: calc(0.5rem * var(--pie-section-player-tab-zoom-comp, 1));
		padding-inline: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
		overflow: hidden;
	}

	.pie-section-player-tabs {
		display: flex;
		gap: 6px;
		background: var(--pie-background, #ffffff);
		border-radius: var(--pie-section-player-tab-track-radius, 9999px);
		border: 1px solid var(--pie-border-gray, #D9DADA);
		padding: var(--pie-section-player-tab-track-padding, 0.25rem);
		width: fit-content;
		align-self: center;
		/*
		 * Freeze the toggle's physical size at its 200%-zoom appearance when
		 * browser zoom exceeds 200%. The factor is 1 at zoom <= 200%, so
		 * behavior below that threshold is unchanged. Using `zoom` (rather
		 * than transform: scale) shrinks the layout box itself, so the
		 * reclaimed space flows to the tab panels below.
		 */
		zoom: var(--pie-section-player-tab-zoom-comp, 1);
	}

	.pie-section-player-tab {
		position: relative;
		border: none;
		border-radius: 24px;
		background: var(--pie-section-player-tab-background, transparent);
		color: var(--pie-section-player-tab-color, #111827);
		padding: var(--pie-section-player-tab-padding-block, 0.35rem) 12px;
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		white-space: nowrap;
	}

	.pie-section-player-tab::after {
		display: none;
	}

	.pie-section-player-tab--active {
		background: var(--pie-section-player-tab-active-background, #1D7375);
		color: var(--pie-section-player-tab-active-color, #ffffff);
	}

	.pie-section-player-tab:focus-visible {
		outline: 2px solid var(--pie-focus-outline, #1d4ed8);
		outline-offset: 2px;
	}

	.pie-section-player-tab-panel {
		min-height: 0;
		min-width: 0;
		height: 100%;
		max-height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color:
			var(--pie-scrollbar-thumb, #6b7280) var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-tab-panel::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, #d1d5db);
		border-radius: 999px;
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, #6b7280);
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, #4b5563);
	}

	.pie-section-player-tab-panel[hidden] {
		display: none;
	}

	.pie-section-player-tab-panel :global(.pie-section-player-passages-pane),
	.pie-section-player-tab-panel :global(.pie-section-player-items-pane) {
		height: 100%;
	}
</style>