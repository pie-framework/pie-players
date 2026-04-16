<script lang="ts">
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
	};`}
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
					Items
				</button>
			</div>
		{/if}

		{#key selectedTab}
			{#if hasPassages && selectedTab === "passage"}
				<div
					id={passagePanelId}
					class="pie-section-player-tab-panel pie-section-player-tab-panel--passages"
					role="tabpanel"
					aria-labelledby={passageTabId}
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
			{:else}
				<div
					id={itemsPanelId}
					class="pie-section-player-tab-panel pie-section-player-tab-panel--items"
					role="tabpanel"
					aria-labelledby={hasPassages ? itemsTabId : undefined}
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
						onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
						onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
						onelement-preload-error={layoutModel.onItemsPanePreloadError}
					></pie-section-player-items-pane>
				</div>
			{/if}
		{/key}

		{#if hasPassages && selectedTab === "passage" && !layoutModel.paneElementsLoaded}
			<!-- Keep item-pane lifecycle active in the background so passage rendering can unblock. -->
			<div class="pie-section-player-tab-preload" aria-hidden="true">
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
					onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
					onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
					onelement-preload-error={layoutModel.onItemsPanePreloadError}
				></pie-section-player-items-pane>
			</div>
		{/if}
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
		gap: var(--pie-section-player-tab-gap, 0.5rem);
		padding: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
		overflow: hidden;
	}

	.pie-section-player-tabs {
		display: flex;
		gap: var(--pie-section-player-tab-spacing, 0.5rem);
		border-bottom: 1px solid
			var(--pie-section-player-tab-border-color, rgba(55, 65, 81, 0.28));
		padding-block-end: 0.125rem;
	}

	.pie-section-player-tab {
		position: relative;
		border: none;
		border-radius: var(--pie-section-player-tab-radius, 0.375rem);
		background: var(--pie-section-player-tab-background, transparent);
		color: var(--pie-section-player-tab-color, #334155);
		padding: var(--pie-section-player-tab-padding-block, 0.4rem)
			var(--pie-section-player-tab-padding-inline, 0.75rem);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.pie-section-player-tab::after {
		content: "";
		position: absolute;
		left: 0;
		right: 0;
		bottom: -0.31rem;
		height: 2px;
		background: transparent;
	}

	.pie-section-player-tab--active {
		color: var(--pie-section-player-tab-active-color, #1d4ed8);
		background: var(--pie-section-player-tab-active-background, transparent);
	}

	.pie-section-player-tab--active::after {
		background: var(--pie-section-player-tab-indicator-color, currentColor);
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

	.pie-section-player-tab-panel :global(.pie-section-player-passages-pane),
	.pie-section-player-tab-panel :global(.pie-section-player-items-pane) {
		height: 100%;
	}

	.pie-section-player-tab-preload {
		position: absolute;
		inline-size: 0;
		block-size: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

</style>
