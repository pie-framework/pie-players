<script lang="ts">
	
	import type { AssessmentEntity, ItemConfig, ItemEntity, PassageEntity, RubricBlock } from '@pie-framework/pie-players-shared/types';
	import ToolAnnotationToolbar from '@pie-framework/pie-tool-annotation-toolbar';
	import { onDestroy, onMount } from 'svelte';
	import type { AssessmentPlayer } from '../player/AssessmentPlayer';
	import AssessmentContent from './components/AssessmentContent.svelte';
	import AssessmentFooter from './components/AssessmentFooter.svelte';
	import AssessmentHeader from './components/AssessmentHeader.svelte';
	import AssessmentNavigation from './components/AssessmentNavigation.svelte';
	import AssessmentToolsBar from './components/AssessmentToolsBar.svelte';

	let {
		player,
		assessment,
		bundleHost,
		organizationId,
		userName
	}: {
		player: AssessmentPlayer;
		assessment: AssessmentEntity;
		bundleHost?: string;
		organizationId?: string | null;
		userName?: string;
	} = $props();

	// State from player
	let currentItem = $state<ItemEntity | null>(null);
	let currentConfig = $state<ItemConfig | null>(null);
	let sessionState = $state<{ id: string; data: any[] }>({ id: '', data: [] });
	let navigationState = $state({
		currentIndex: 0,
		totalItems: 0,
		canNext: false,
		canPrevious: false,
		isLoading: true
	});
	let isLoadingItem = $state(true);
	let passage = $state<PassageEntity | null>(null);
	let rubricBlocks = $state<RubricBlock[]>([]);

	// Picture Dictionary Modal state
	let showPictureDictionaryModal = $state(false);
	let pictureDictionaryWord = $state('');

	// Annotation toolbar event handlers
	function handleDictionaryLookup(detail: { text: string }) {
		// TODO: Open dictionary modal
		console.log('Dictionary lookup:', detail.text);
	}

	function handleTranslationRequest(detail: { text: string }) {
		// TODO: Open translation modal
		console.log('Translation request:', detail.text);
	}

	function handlePictureDictionaryLookup(detail: { text: string }) {
		pictureDictionaryWord = detail.text;
		showPictureDictionaryModal = true;
	}

	// Load passage when item changes
	async function loadPassage(item: ItemEntity | null) {
		if (!item?.passage) {
			passage = null;
			return;
		}

		// If passage is already a full entity, use it
		if (typeof item.passage === 'object' && 'id' in item.passage) {
			passage = item.passage as PassageEntity;
			return;
		}

		// Otherwise load by ID
		if (typeof item.passage === 'string') {
			try {
				const url = organizationId
					? `/api/passage/${item.passage}?organizationId=${encodeURIComponent(organizationId)}`
					: `/api/passage/${item.passage}`;
				const response = await fetch(url);
				if (response.ok) {
					passage = await response.json();
				} else {
					passage = null;
				}
			} catch (error) {
				console.error('[ReferenceLayout] Error loading passage:', error);
				passage = null;
			}
		}
	}

	// Subscribe to player state changes
	let unsubNav: (() => void) | null = null;
	let unsubItem: (() => void) | null = null;
	let unsubLoading: (() => void) | null = null;
	let unsubSession: (() => void) | null = null;

	onMount(() => {
		unsubNav = player.onNavigationChange((state) => {
			navigationState = state;
			rubricBlocks =
				player
					.getCurrentSectionRubricBlocks()
					.filter((b) => b.view === 'candidate');
		});

		unsubItem = player.onItemChange((item) => {
			currentItem = item;
			currentConfig = item?.config as ItemConfig | null;
			loadPassage(item);
		});

		unsubLoading = player.onLoadingChange((loading) => {
			isLoadingItem = loading;
		});

		unsubSession = player.onSessionChange((session) => {
			sessionState = session;
		});
	});

	onDestroy(() => {
		unsubNav?.();
		unsubItem?.();
		unsubLoading?.();
		unsubSession?.();
	});
</script>

<div class="reference-layout">
	<!-- Header -->
	<AssessmentHeader
		{player}
		{assessment}
		currentQuestion={navigationState.currentIndex + 1}
		totalQuestions={navigationState.totalItems}
		{userName}
	/>

	<!-- Navigation -->
	<AssessmentNavigation
		{player}
		currentIndex={navigationState.currentIndex}
		totalItems={navigationState.totalItems}
	/>

	<!-- Main Content -->
	<AssessmentContent
		{player}
		currentItem={currentItem}
		config={currentConfig}
		{passage}
		{rubricBlocks}
		session={sessionState}
		{bundleHost}
		{organizationId}
		isLoading={isLoadingItem}
	/>

	<!-- Tools Bar -->
	<AssessmentToolsBar {player} />

	<!-- Footer -->
	<AssessmentFooter
		{player}
		currentQuestion={navigationState.currentIndex + 1}
		totalQuestions={navigationState.totalItems}
		canNext={navigationState.canNext}
		canPrevious={navigationState.canPrevious}
	/>
</div>

<!-- Annotation Toolbar (floating, appears on text selection) -->
<!-- Outside layout container to avoid overflow: hidden affecting fixed positioning -->
<ToolAnnotationToolbar
	enabled={true}
	ttsService={player.getTTSService()}
	highlightCoordinator={player.getHighlightCoordinator()}
	ondictionarylookup={handleDictionaryLookup}
	ontranslationrequest={handleTranslationRequest}
	onpicturedictionarylookup={handlePictureDictionaryLookup}
/>

<!-- Picture Dictionary Modal -->
<PictureDictionaryModal
	bind:visible={showPictureDictionaryModal}
	word={pictureDictionaryWord}
	organizationId={organizationId || undefined}
/>

<style>
	.reference-layout {
		display: grid;
		grid-template-rows: auto auto 1fr auto auto;
		grid-template-columns: 1fr;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background-color: var(--pie-background, #ffffff);
	}

	/* Ensure grid rows don't overflow */
	:global(.reference-layout > *) {
		min-height: 0;
	}
</style>

