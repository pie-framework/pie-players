<script lang="ts">
	import { useInterfaceI18n } from "./use-interface-i18n.svelte.js";

	type LayoutModel = {
		passages: unknown[];
		paneElementsLoaded: boolean;
	};

	let {
		layoutModel,
		contentMaxWidthNoPassagePx = undefined as number | undefined,
		contentMaxWidthWithPassagePx = undefined as number | undefined,
	} = $props<{
		layoutModel: LayoutModel;
		contentMaxWidthNoPassagePx?: number;
		contentMaxWidthWithPassagePx?: number;
	}>();

	let frameElement = $state<HTMLDivElement | null>(null);
	const interfaceI18n = useInterfaceI18n(() => frameElement);

	const layoutMaxWidthPx = $derived(
		layoutModel.passages.length > 0
			? contentMaxWidthWithPassagePx
			: contentMaxWidthNoPassagePx,
	);
</script>

<div
	bind:this={frameElement}
	class="pie-section-player-vertical-frame"
	style={`--pie-section-player-layout-max-width: ${
		layoutMaxWidthPx !== undefined ? `${layoutMaxWidthPx}px` : "none"
	};`}
>
	<div class="pie-section-player-vertical-content">
		{#if layoutModel.passages.length > 0 && layoutModel.paneElementsLoaded}
			<section class="pie-section-player-passages-section" aria-label={interfaceI18n.t("player.passagesRegionA11y")}>
				<pie-section-player-passages-pane></pie-section-player-passages-pane>
			</section>
		{/if}

		<section class="pie-section-player-items-section" aria-label={interfaceI18n.t("player.itemsRegionA11y")}>
			<pie-section-player-items-pane></pie-section-player-items-pane>
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
			var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280)) var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-vertical-content::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
		border-radius: 999px;
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280));
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-vertical-content::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, var(--pie-border-dark, #4b5563));
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
