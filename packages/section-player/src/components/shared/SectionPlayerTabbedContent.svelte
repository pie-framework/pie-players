<script lang="ts">
	import { untrack } from "svelte";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import { useZoomCompensation } from "@pie-players/pie-players-shared/ui/use-zoom-compensation";
	import { useInterfaceI18n } from "./use-interface-i18n.svelte.js";

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

	let frameElement = $state<HTMLDivElement | null>(null);
	const interfaceI18n = useInterfaceI18n(() => frameElement);

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
	 * `minCompensation` is the floor on that shrink factor, and once it bites
	 * the toggle grows past 200% again (apparent size = zoom * floor). We keep
	 * it below `maxZoom / maxBrowserZoom` (2 / 5 = 0.4) so the cap holds across
	 * the full browser zoom range: the `outerWidth / innerWidth` estimate
	 * overshoots real zoom (browser chrome shrinks innerWidth), so at a real
	 * 500% the ratio already reads above 5 and a 0.4 floor would let the toggle
	 * grow again. 0.25 pushes the floor's bite point to a ratio of 8, past any
	 * real browser zoom, while still guarding against an unusably small toggle.
	 *
	 * NOTE: this same factor is also applied to the vertical spacing
	 * (gap + block padding) surrounding the toggle in
	 * .pie-section-player-tabbed-content, via the same CSS variable. The
	 * `zoom` property only shrinks the toggle element itself; the flex gap
	 * and padding live outside that element and would otherwise keep
	 * growing with real browser zoom, silently eating back the vertical
	 * space this work is meant to reclaim.
	 */
	const toggleZoom = useZoomCompensation({
		maxZoom: 2,
		minCompensation: 0.25,
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
	bind:this={frameElement}
	class="pie-section-player-tabbed-frame"
	style={`--pie-section-player-layout-max-width: ${
		layoutMaxWidthPx !== undefined ? `${layoutMaxWidthPx}px` : "none"
	}; --pie-section-player-tab-zoom-comp: ${toggleZoom.current};`}
>
	<div class="pie-section-player-tabbed-content">
		{#if hasPassages}
			<div class="pie-section-player-tabs" role="tablist" aria-label={interfaceI18n.t("player.sectionTabsA11y")}>
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
					{interfaceI18n.t("player.passage")}
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
					{interfaceI18n.t("player.questions")}
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
					compositionModel={layoutModel.compositionModel}
					passages={layoutModel.passages}
					elementsLoaded={layoutModel.paneElementsLoaded}
					resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
					resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
					resolvedPlayerProps={layoutModel.resolvedPlayerProps}
					baseHeadingLevel={layoutModel.baseHeadingLevel}
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
				baseHeadingLevel={layoutModel.baseHeadingLevel}
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
		/*
		 * `--pie-border-gray` clears the 3:1 non-text minimum in every scheme and
		 * is stepped to it under the DaisyUI provider. The literal only applies to
		 * a host that mounts the player with no theme at all, where #D9DADA left
		 * the track at 1.2:1 against the frame -- the same grey the button border
		 * defaults to holds there instead.
		 */
		border: 1px solid var(--pie-border-gray, #767676);
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
		/*
		 * The unselected tab is transparent, so its ink has to hold against the
		 * track's own `--pie-background`. Resolving the hook through `--pie-text`
		 * is what keeps it on the certified ordinary-text pair; a literal here
		 * stays near-black under every scheme and disappears on the dark ones.
		 */
		color: var(--pie-section-player-tab-color, var(--pie-text, #111827));
		padding: var(--pie-section-player-tab-padding-block, 0.35rem) 12px;
		font: inherit;
		/* Was a hard `12px`, the only pixel type size in the content path: it
		   ignored the font accommodation and the reader's own browser font size
		   alike, leaving 12px tab labels beside body text at 175%. `0.75rem` is
		   the same 12px at a default root, so this only diverges for a host that
		   moves the root size — which is the point of using rem. */
		font-size: calc(0.75rem * var(--pie-font-scale, 1));
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s ease, color 0.15s ease;
		white-space: nowrap;
	}

	.pie-section-player-tab::after {
		display: none;
	}

	.pie-section-player-tab--active {
		/*
		 * The selected pill carries a fixed brand hue, so it behaves like any other
		 * fixed encoding: pinned while no scheme is asking for a palette, folded
		 * into that palette when one is. #1D7375 does not follow a scheme at all,
		 * and as the selection indicator it measured 1.42:1 against the track under
		 * Yellow on Navy, 2.26:1 under Light Gray on Dark Gray and 2.80:1 under
		 * Black on Violet, where 1.4.11 asks for 3:1.
		 *
		 * At 100% collapse the fill becomes --pie-primary and the ink the page
		 * colour, which is the one pairing that holds on every scheme: 5.44:1 or
		 * better for the text, and the same ratio separating the pill from the
		 * track it sits on, since the track paints --pie-background. Mixing rather
		 * than substituting is what keeps the ink out of the light Base Theme's
		 * transparent --pie-background, where it would render invisible: that end
		 * of the mix is the pinned white, exact at 0%.
		 */
		background: var(
			--pie-section-player-tab-active-background,
			color-mix(in srgb, var(--pie-primary, #1D7375) var(--pie-fixed-hue-collapse, 0%), #1D7375)
		);
		color: var(
			--pie-section-player-tab-active-color,
			color-mix(in srgb, var(--pie-background, #ffffff) var(--pie-fixed-hue-collapse, 0%), #ffffff)
		);
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
			var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280)) var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-tab-panel::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
		border-radius: 999px;
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280));
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-tab-panel::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, var(--pie-border-dark, #4b5563));
	}

	.pie-section-player-tab-panel[hidden] {
		display: none;
	}

	.pie-section-player-tab-panel :global(.pie-section-player-passages-pane),
	.pie-section-player-tab-panel :global(.pie-section-player-items-pane) {
		height: 100%;
	}
</style>