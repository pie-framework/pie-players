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

	let {
		layoutModel,
		itemToolbarTools = "",
		passageToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		iifeBundleHost,
		preloadComponentTag = "pie-section-player-vertical",
		contentMaxWidthNoPassagePx = undefined as number | undefined,
		contentMaxWidthWithPassagePx = undefined as number | undefined,
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
	}>();

	const layoutMaxWidthPx = $derived(
		layoutModel.passages.length > 0
			? contentMaxWidthWithPassagePx
			: contentMaxWidthNoPassagePx,
	);
</script>

<div
	class="pie-section-player-vertical-frame"
	style={`--pie-section-player-layout-max-width: ${
		layoutMaxWidthPx !== undefined ? `${layoutMaxWidthPx}px` : "none"
	};`}
>
	<div class="pie-section-player-vertical-content">
		{#if layoutModel.passages.length > 0 && layoutModel.paneElementsLoaded}
			<section class="pie-section-player-passages-section" aria-label="Passages">
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
			</section>
		{/if}

		<section class="pie-section-player-items-section" aria-label="Items">
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
		</section>
	</div>
</div>

<style>
	.pie-section-player-vertical-frame {
		width: 100%;
		max-width: var(--pie-section-player-layout-max-width, none);
		height: 100%;
		min-height: 0;
		max-height: 100%;
		margin-inline: auto;
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
		scrollbar-width: thin;
		scrollbar-color:
			var(--pie-scrollbar-thumb, #6b7280) var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-vertical-content::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, #d1d5db);
		border-radius: 999px;
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, #6b7280);
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, #4b5563);
	}

	.pie-section-player-passages-section,
	.pie-section-player-items-section {
		min-height: 0;
		/* Prevent flexbox from compressing content sections.
		   Let the vertical container own scrolling instead. */
		flex: 0 0 auto;
	}

	.pie-section-player-passages-section {
		width: 100%;
	}
</style>
