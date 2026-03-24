<script lang="ts">
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
		onItemsPaneElementsLoaded: (event: Event) => void;
		onItemsPanePreloadRetry: (event: Event) => void;
		onItemsPanePreloadError: (event: Event) => void;
	};

	let {
		layoutModel,
		itemToolbarTools = "",
		passageToolbarTools = "",
		iifeBundleHost,
		preloadComponentTag = "pie-section-player-vertical",
	} = $props<{
		layoutModel: LayoutModel;
		itemToolbarTools?: string;
		passageToolbarTools?: string;
		iifeBundleHost?: string;
		preloadComponentTag?: string;
	}>();
</script>

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
			iifeBundleHost={iifeBundleHost}
			preloadedRenderables={layoutModel.preloadedRenderables}
			preloadedRenderablesSignature={layoutModel.preloadedRenderablesSignature}
			{preloadComponentTag}
			onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
			onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
			onelement-preload-error={layoutModel.onItemsPanePreloadError}
		></pie-section-player-items-pane>
	</section>
</div>

<style>
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
