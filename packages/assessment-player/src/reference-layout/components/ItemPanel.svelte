<script lang="ts">
	import type { ItemConfig, ItemEntity } from '@pie-players/pie-players-shared';
	import type { ToolCoordinator } from '@pie-players/pie-assessment-toolkit';
	import type {
		ITTSService,
		IHighlightCoordinator,
		IElementToolStateStore
	} from '@pie-players/pie-assessment-toolkit';
	import '@pie-players/pie-iife-player';
	import '@pie-players/pie-assessment-toolkit/components/QuestionToolBar.svelte';

	// NOTE: Parent applications using ItemPanel with showHeader=true must import tool web components:
	//   import '@pie-players/pie-tool-answer-eliminator';
	//   import '@pie-players/pie-tool-tts-inline';
	//   import '@pie-players/pie-tool-calculator-inline';
	//   import '@pie-players/pie-tool-calculator';

	let {
		currentItem,
		config,
		session,
		bundleHost,
		env,
		assessmentId = '',
		sectionId = '',
		toolCoordinator,
		ttsService,
		highlightCoordinator,
		catalogResolver,
		elementToolStateStore,
		showHeader = false,
		isLoading = false
	}: {
		currentItem: ItemEntity | null;
		config: ItemConfig | null;
		session: { id: string; data: any[] };
		bundleHost?: string;
		env: { mode: string; role?: string };
		assessmentId?: string;
		sectionId?: string;
		toolCoordinator?: ToolCoordinator;
		ttsService?: ITTSService;
		highlightCoordinator?: IHighlightCoordinator;
		catalogResolver?: any;
		elementToolStateStore?: IElementToolStateStore;
		showHeader?: boolean;
		isLoading?: boolean;
	} = $props();

	let piePlayerElement = $state<HTMLElement | null>(null);
	let itemContentElement = $state<HTMLElement | null>(null);
	let questionToolbarElement = $state<HTMLElement | null>(null);
	let toolbarServicesBound = $state(false);
	let calculatorElement = $state<HTMLElement | null>(null);
	let calculatorVisible = $state(false);

	// Bind services, scope, and IDs to question toolbar (must be JS properties)
	$effect(() => {
		if (questionToolbarElement && !toolbarServicesBound && showHeader) {
			if (toolCoordinator) {
				(questionToolbarElement as any).toolCoordinator = toolCoordinator;
			}
			if (ttsService) {
				(questionToolbarElement as any).ttsService = ttsService;
			}
			if (highlightCoordinator) {
				(questionToolbarElement as any).highlightCoordinator = highlightCoordinator;
			}
			if (itemContentElement) {
				(questionToolbarElement as any).scopeElement = itemContentElement;
			}
			if (elementToolStateStore) {
				(questionToolbarElement as any).elementToolStateStore = elementToolStateStore;
			}
			if (assessmentId) {
				(questionToolbarElement as any).assessmentId = assessmentId;
			}
			if (sectionId) {
				(questionToolbarElement as any).sectionId = sectionId;
			}

			toolbarServicesBound = true;
		}
	});

	// Bind coordinator to calculator tool
	$effect(() => {
		if (calculatorElement && toolCoordinator) {
			(calculatorElement as any).coordinator = toolCoordinator;
		}
	});

	// Subscribe to calculator visibility changes
	$effect(() => {
		if (!showHeader || !toolCoordinator || !currentItem) return;

		const unsubscribe = toolCoordinator.subscribe(() => {
			calculatorVisible = toolCoordinator.isToolVisible(`calculator-${currentItem.id}`);
		});

		// Initial update
		calculatorVisible = toolCoordinator.isToolVisible(`calculator-${currentItem.id}`);

		return unsubscribe;
	});
</script>

<div
	class="item-panel"
	data-assessment-id={assessmentId}
	data-section-id={sectionId}
	data-item-id={currentItem?.id}
>
	{#if isLoading}
		<div class="loading-container">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if config}
		<!-- Optional Question Header with Toolbar -->
		{#if showHeader && currentItem}
			<div class="item-header">
				<h4 class="item-title">{currentItem.name || 'Question'}</h4>
				<pie-question-toolbar
					bind:this={questionToolbarElement}
					item-id={currentItem.id}
					catalog-id={currentItem.id}
					tools="tts,answerEliminator,calculator"
					size="md"
					language="en-US"
				></pie-question-toolbar>
			</div>
		{/if}

		<div class="item-content" bind:this={itemContentElement}>
			<pie-iife-player
				bind:this={piePlayerElement}
				config={config}
				env={env}
				session={session}
				hosted={false}
				show-bottom-border={false}
				bundle-host={bundleHost}
			></pie-iife-player>
		</div>
	{:else}
		<div class="empty-container">
			<p class="empty-message">Question could not be loaded.</p>
		</div>
	{/if}

	<!-- Calculator Tool Instance (rendered outside panel for floating overlay) -->
	{#if showHeader && currentItem}
		<pie-tool-calculator
			bind:this={calculatorElement}
			visible={calculatorVisible}
			tool-id="calculator-{currentItem.id}"
		></pie-tool-calculator>
	{/if}
</div>

<style>
	.item-panel {
		height: 100%;
		padding: 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
		margin-bottom: 0.5rem;
	}

	.item-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--pie-primary, #1976d2);
	}

	.item-content {
		position: relative;
	}

	.loading-container,
	.empty-container {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.empty-message {
		color: var(--pie-text-secondary, #666);
		font-style: italic;
	}
</style>

