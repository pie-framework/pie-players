<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
	} from '@pie-players/pie-assessment-toolkit';
	import { SectionController, type SectionCompositionModel } from '@pie-players/pie-section-player';
	import type { AssessmentSection, ItemEntity } from '@pie-players/pie-players-shared/types';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const EMPTY_COMPOSITION: SectionCompositionModel = {
		section: null,
		assessmentItemRefs: [],
		passages: [],
		items: [],
		rubricBlocks: [],
		instructions: [],
		currentItemIndex: 0,
		currentItem: null,
		isPageMode: false,
		itemSessionsByItemId: {},
		testAttemptSession: null
	};
	const IIFE_BUNDLE_HOST = 'https://proxy.pie-api.com/bundles';

	let toolkitElement = $state<any>(null);
	let layoutRootElement = $state<HTMLDivElement | null>(null);
	let compositionModel = $state<SectionCompositionModel>(EMPTY_COMPOSITION);
	let lastCompositionSignature = $state('');
	let errorMessage = $state<string | null>(null);
	let leftPanelWidth = $state(50);
	let isDragging = $state(false);
	let splitContainerElement = $state<HTMLDivElement | null>(null);

	const resolvedSection: AssessmentSection | null = (() => {
		const section = data.section;
		if (!section) return null;
		const sectionAny = section as any;
		const hasExplicitPnp = Boolean(
			sectionAny?.personalNeedsProfile || sectionAny?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile()
		};
	})();

	let passages = $derived(compositionModel.passages || []);
	let items = $derived(compositionModel.items || []);
	let itemSessionsByItemId = $derived(compositionModel.itemSessionsByItemId || {});
	let hasPassages = $derived(passages.length > 0);
	const toolkitToolsConfig = {
		floatingTools: {
			calculator: {
				provider: 'desmos',
				authFetcher: fetchDesmosAuthConfig
			}
		}
	};

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	function getCompositionSignature(model: SectionCompositionModel | null | undefined): string {
		if (!model) return '';
		return JSON.stringify({
			sectionId: model.section?.identifier || '',
			currentItemIndex: model.currentItemIndex ?? -1,
			itemIds: (model.items || []).map((item) => item?.id || ''),
			passageIds: (model.passages || []).map((passage) => passage?.id || ''),
			sessionKeys: Object.keys(model.itemSessionsByItemId || {}).sort()
		});
	}

	function handleCompositionChanged(event: Event) {
		const detail = (event as CustomEvent<{ composition?: SectionCompositionModel }>).detail;
		const nextComposition = detail?.composition || EMPTY_COMPOSITION;
		const nextSignature = getCompositionSignature(nextComposition);
		if (nextSignature === lastCompositionSignature) return;
		lastCompositionSignature = nextSignature;
		compositionModel = nextComposition;
	}

	function getSessionForItem(item: ItemEntity): unknown {
		const itemId = item.id || '';
		return itemSessionsByItemId[itemId];
	}

	function handleDividerMouseDown(event: MouseEvent) {
		event.preventDefault();
		isDragging = true;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleDividerMouseMove(event: MouseEvent) {
		if (!isDragging || !splitContainerElement) return;
		const containerRect = splitContainerElement.getBoundingClientRect();
		const offsetX = event.clientX - containerRect.left;
		const newWidth = (offsetX / containerRect.width) * 100;
		if (newWidth >= 20 && newWidth <= 80) {
			leftPanelWidth = newWidth;
		}
	}

	function handleDividerMouseUp() {
		if (!isDragging) return;
		isDragging = false;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
	}

	function handleDividerKeyDown(event: KeyboardEvent) {
		const step = 5;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			leftPanelWidth = Math.max(20, leftPanelWidth - step);
		}
		if (event.key === 'ArrowRight') {
			event.preventDefault();
			leftPanelWidth = Math.min(80, leftPanelWidth + step);
		}
	}

	$effect(() => {
		if (!isDragging) return;
		window.addEventListener('mousemove', handleDividerMouseMove);
		window.addEventListener('mouseup', handleDividerMouseUp);
		return () => {
			window.removeEventListener('mousemove', handleDividerMouseMove);
			window.removeEventListener('mouseup', handleDividerMouseUp);
		};
	});

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.createSectionController = () => new SectionController();
	});

	onMount(async () => {
		const imports: Promise<unknown>[] = [];
		if (!customElements.get('pie-iife-player')) {
			imports.push(import('@pie-players/pie-iife-player'));
		}
		if (!customElements.get('pie-section-tools-toolbar')) {
			imports.push(import('@pie-players/pie-section-tools-toolbar'));
		}
		if (!customElements.get('pie-tool-calculator')) {
			imports.push(import('@pie-players/pie-tool-calculator'));
		}
		if (!customElements.get('pie-item-toolbar')) {
			imports.push(import('@pie-players/pie-assessment-toolkit/components/item-toolbar-element'));
		}
		if (!customElements.get('pie-assessment-toolkit')) {
			imports.push(import('@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element'));
		}
		if (!customElements.get('pie-item-shell') || !customElements.get('pie-passage-shell')) {
			imports.push(import('@pie-players/pie-section-player'));
		}
		await Promise.all(imports);
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Direct Split Layout</title>
</svelte:head>

<div class="direct-layout" bind:this={layoutRootElement}>
	{#if errorMessage}
		<div class="error-state">{errorMessage}</div>
	{:else}
		<pie-assessment-toolkit
			bind:this={toolkitElement}
			assessment-id={data.demo?.id || 'section-demo-direct'}
			section={resolvedSection}
			player-type="iife"
			view="candidate"
			lazy-init={true}
			tools={toolkitToolsConfig}
			oncomposition-changed={handleCompositionChanged}
		>
			<div class="layout-header">
				<h1>{data.demo?.name || 'Direct Split Layout Demo'}</h1>
			</div>
			<div class="layout-body">
				<div
					class={`split-content ${!hasPassages ? 'split-content--no-passages' : ''}`}
					bind:this={splitContainerElement}
					style={hasPassages
						? `grid-template-columns: ${leftPanelWidth}% 0.5rem ${100 - leftPanelWidth - 0.5}%`
						: 'grid-template-columns: 1fr'}
				>
					{#if hasPassages}
						<aside class="passages-pane" aria-label="Passages">
							{#each passages as passage, passageIndex (passage.id || passageIndex)}
								<pie-passage-shell
									item-id={passage.id}
									content-kind="rubric-block-stimulus"
									item={passage}
								>
									<div class="content-card">
										<div
											class="content-card-header pie-section-player__passage-header"
											data-region="header"
										>
											<h2>Passage {passageIndex + 1}</h2>
											<pie-item-toolbar
												item-id={passage.id}
												catalog-id={passage.id}
												tools="tts"
												content-kind="rubric-block-stimulus"
												size="md"
												language="en-US"
											></pie-item-toolbar>
										</div>
										<div
											class="content-card-body pie-section-player__passage-content"
											data-region="content"
										>
											<pie-iife-player
												config={JSON.stringify(passage.config || {})}
												env={JSON.stringify({ mode: 'view', role: 'student' })}
												bundle-host={IIFE_BUNDLE_HOST}
												skip-element-loading={true}
											></pie-iife-player>
										</div>
									</div>
								</pie-passage-shell>
							{/each}
						</aside>

						<button
							type="button"
							class={`split-divider ${isDragging ? 'split-divider--dragging' : ''}`}
							onmousedown={handleDividerMouseDown}
							onkeydown={handleDividerKeyDown}
							aria-label="Resize panels"
						>
							<span class="split-divider-handle"></span>
						</button>
					{/if}

					<main class="items-pane" aria-label="Items">
						{#each items as item, itemIndex (item.id || itemIndex)}
							<pie-item-shell
								item-id={item.id}
								content-kind="assessment-item"
								item={item}
							>
								<div class="content-card">
									<div class="content-card-header pie-section-player__item-header" data-region="header">
										<h2>Question {itemIndex + 1}</h2>
										<pie-item-toolbar
											item-id={item.id}
											catalog-id={item.id}
											tools="calculator,tts,answerEliminator"
											content-kind="assessment-item"
											size="md"
											language="en-US"
										></pie-item-toolbar>
									</div>
									<div
										class="content-card-body pie-section-player__item-content"
										data-region="content"
									>
										<pie-iife-player
											config={JSON.stringify(item.config || {})}
											env={JSON.stringify({ mode: 'gather', role: 'student' })}
											session={JSON.stringify(getSessionForItem(item) || { id: '', data: [] })}
											bundle-host={IIFE_BUNDLE_HOST}
										></pie-iife-player>
									</div>
									<div data-region="footer"></div>
								</div>
							</pie-item-shell>
						{/each}
					</main>
				</div>

				<aside class="section-toolbar-pane" aria-label="Section tools">
					<pie-section-tools-toolbar
						position="right"
						enabled-tools="graph,periodicTable,protractor,lineReader,ruler"
					></pie-section-tools-toolbar>
				</aside>
			</div>
		</pie-assessment-toolkit>
	{/if}
</div>

<style>
	:global(pie-assessment-toolkit) {
		display: flex;
		flex-direction: column;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.direct-layout {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		padding: 1rem;
		gap: 1rem;
	}

	.layout-header h1 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 700;
	}

	.layout-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		height: 100%;
		overflow: hidden;
	}

	.split-content--no-passages .items-pane {
		padding-left: 0;
	}

	.passages-pane,
	.items-pane {
		height: 100%;
		min-height: 0;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-toolbar-pane {
		border-left: 1px solid var(--pie-border-light, #e5e7eb);
		padding-left: 0.5rem;
		min-height: 0;
		overflow: auto;
	}

	.split-divider {
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.split-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.split-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.split-divider-handle {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.split-divider-handle::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.split-divider:hover .split-divider-handle,
	.split-divider:focus .split-divider-handle,
	.split-divider--dragging .split-divider-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.split-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}

	.content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-white, #fff);
	}

	.content-card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.content-card-header h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.content-card-body {
		padding: 1rem;
	}

	.error-state {
		color: var(--pie-incorrect-icon, #b00020);
		padding: 1rem;
		border: 1px solid var(--pie-incorrect, #f6c3c6);
		background: var(--pie-incorrect-secondary, #fff1f2);
		border-radius: 8px;
	}

	@media (max-width: 1100px) {
		.layout-body {
			grid-template-columns: 1fr;
		}

		.split-content {
			grid-template-columns: 1fr !important;
		}

		.split-divider {
			display: none;
		}

		.section-toolbar-pane {
			border-left: none;
			padding-left: 0;
		}
	}
</style>
