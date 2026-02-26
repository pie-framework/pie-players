<svelte:options
	customElement={{
		tag: 'pie-item-toolbar',
		shadow: 'none',
		props: {
			itemId: { type: 'String', attribute: 'item-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			tools: { type: 'String', attribute: 'tools' },
			contentKind: { type: 'String', attribute: 'content-kind' },
			size: { type: 'String', attribute: 'size' },
			language: { type: 'String', attribute: 'language' },

			// Local runtime contracts (passed as JS properties, not attributes)
			scopeElement: { type: 'Object', reflect: false },
			toolRegistry: { type: 'Object', reflect: false },
			pnpResolver: { type: 'Object', reflect: false },
			assessment: { type: 'Object', reflect: false },
			itemRef: { type: 'Object', reflect: false },
			item: { type: 'Object', reflect: false }
		}
	}}
/>

<!--
  ItemToolBar - Inline toolbar for item/passage headers

  Button visibility is always registry-driven:
  - Pass 1: allowed tool IDs (PNP resolver when available, otherwise explicit tools prop)
  - Pass 2: tool-owned isVisibleInContext(context)
-->
<script lang="ts">
	import {
		type AssessmentToolkitRuntimeContext
	} from '../context/assessment-toolkit-context.js';
	import { connectAssessmentToolkitRuntimeContext } from '../context/runtime-context-consumer.js';
	import type { ToolRegistry } from '../services/ToolRegistry.js';
	import type { PNPToolResolver } from '../services/PNPToolResolver.js';
	import { createDefaultToolRegistry } from '../services/createDefaultToolRegistry.js';
	import type { AssessmentEntity, AssessmentItemRef, ItemEntity } from '@pie-players/pie-players-shared/types';
	import type { ElementToolContext, ItemToolContext } from '../services/tool-context.js';

	const isBrowser = typeof window !== 'undefined';
	const fallbackToolRegistry = createDefaultToolRegistry();

	function normalizeToolId(toolId: string): string {
		if (toolId === 'tts') return 'textToSpeech';
		return toolId;
	}

	// Track if tools have been loaded
	let toolsLoaded = $state(false);

	// Props
	let {
		itemId = '',
		catalogId = '',
		tools = 'calculator,textToSpeech,answerEliminator',
		contentKind = 'assessment-item',
		scopeElement = null,
		toolRegistry = null,
		pnpResolver = null,
		assessment = null,
		itemRef = null,
		item = null,
		class: className = '',
		size = 'md' as 'sm' | 'md' | 'lg',
		language = 'en-US'
	}: {
		itemId?: string;
		catalogId?: string;
		tools?: string;
		contentKind?: string;
		scopeElement?: HTMLElement | null;
		toolRegistry?: ToolRegistry | null;
		pnpResolver?: PNPToolResolver | null;
		assessment?: AssessmentEntity | null;
		itemRef?: AssessmentItemRef | null;
		item?: ItemEntity | null;
		class?: string;
		size?: 'sm' | 'md' | 'lg';
		language?: string;
	} = $props();

	let toolbarRootElement = $state<HTMLDivElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let ttsReadyRequested = $state(false);

	$effect(() => {
		if (!toolbarRootElement) return;
		return connectAssessmentToolkitRuntimeContext(toolbarRootElement, (value) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		if (!runtimeContext?.toolkitCoordinator) return;
		if (!allowedToolIds.includes('textToSpeech')) return;
		if (ttsReadyRequested) return;
		ttsReadyRequested = true;
		void runtimeContext.toolkitCoordinator.ensureTTSReady().catch((error: unknown) => {
			console.error('[ItemToolBar] Failed to initialize TTS service:', error);
		});
	});

	const effectiveToolCoordinator = $derived(runtimeContext?.toolCoordinator);
	const effectiveTTSService = $derived(runtimeContext?.ttsService);
	const effectiveElementToolStateStore = $derived(runtimeContext?.elementToolStateStore);
	const effectiveAssessmentId = $derived(runtimeContext?.assessmentId ?? '');
	const effectiveSectionId = $derived(runtimeContext?.sectionId ?? '');

	// Generate globalElementId using store utility
	let globalElementId = $derived.by(() => {
		if (!effectiveElementToolStateStore || !effectiveAssessmentId || !effectiveSectionId || !itemId)
			return null;
		return effectiveElementToolStateStore.getGlobalElementId(
			effectiveAssessmentId,
			effectiveSectionId,
			itemId,
			itemId
		);
		// Note: Using itemId as elementId since toolbar is scoped to one item/element
	});

	// Effective registry for visibility and metadata ownership.
	const effectiveToolRegistry = $derived(toolRegistry || fallbackToolRegistry);

	const enabledTools = $derived(
		tools
			.split(',')
			.map((t) => t.trim())
			.map(normalizeToolId)
			.filter((toolId) => contentKind === 'assessment-item' || toolId !== 'calculator')
			.filter(Boolean)
	);

	// Pass 1: determine allowed tools
	const allowedToolIds = $derived.by(() => {
		if (pnpResolver && assessment && itemRef) {
			const allowedByPnp = pnpResolver.getAllowedToolIds(assessment, itemRef);
			if (enabledTools.length === 0) return allowedByPnp;
			return allowedByPnp.filter((toolId) => enabledTools.includes(toolId));
		}
		return enabledTools;
	});

	const toolContext = $derived.by((): ItemToolContext | null => {
		if (!item) {
			return null;
		}
		return {
			level: 'item',
			assessment: (assessment || {}) as AssessmentEntity,
			itemRef: (itemRef || ({ id: itemId } as AssessmentItemRef)) as AssessmentItemRef,
			item
		};
	});

	const elementContexts = $derived.by((): ElementToolContext[] => {
		if (!item) return [];
		const modelsRaw = (item as any)?.config?.models;
		const models = Array.isArray(modelsRaw)
			? modelsRaw
			: modelsRaw && typeof modelsRaw === 'object'
				? Object.values(modelsRaw)
				: [];
		return models
			.filter((model: any) => model && typeof model === 'object' && typeof model.id === 'string')
			.map((model: any) => ({
				level: 'element' as const,
				assessment: (assessment || {}) as AssessmentEntity,
				itemRef: (itemRef || ({ id: itemId } as AssessmentItemRef)) as AssessmentItemRef,
				item,
				elementId: model.id as string
			}));
	});

	// Pass 2: tool-owned context filtering (item + element aggregation)
	const visibleToolIds = $derived.by(() => {
		if (!toolContext && elementContexts.length === 0) {
			return allowedToolIds;
		}
		const visible = new Set<string>();
		if (toolContext) {
			effectiveToolRegistry.filterVisibleInContext(allowedToolIds, toolContext).forEach((tool) => visible.add(tool.toolId));
		}

		for (const context of elementContexts) {
			effectiveToolRegistry.filterVisibleInContext(allowedToolIds, context).forEach((tool) => visible.add(tool.toolId));
		}

		return Array.from(visible);
	});

	// Handle tool click (activates tool)
	async function handleToolClick(toolId: string) {
		console.log('[ItemToolBar] Tool clicked:', toolId);

		if (!effectiveToolCoordinator) {
			console.warn('[ItemToolBar] No toolCoordinator available');
			return;
		}

		// Registry-owned lazy module loading before tool activation.
		if (effectiveToolRegistry) {
			await effectiveToolRegistry.ensureToolModuleLoaded(toolId);
		}

		// Toggle tool visibility
		const fullToolId = `${toolId}-${itemId}`;
		effectiveToolCoordinator.toggleTool(fullToolId);
	}

	// Dynamically load tool components needed by visible toolbar tools
	$effect(() => {
		if (!isBrowser || toolsLoaded) return;

		(async () => {
			const loadPromises = [];

			if (allowedToolIds.includes('textToSpeech')) {
				loadPromises.push(import('@pie-players/pie-tool-tts-inline'));
			}
			if (allowedToolIds.includes('answerEliminator')) {
				loadPromises.push(import('@pie-players/pie-tool-answer-eliminator'));
			}
			if (allowedToolIds.includes('calculator')) {
				loadPromises.push(
					import('@pie-players/pie-tool-calculator-inline'),
					import('@pie-players/pie-tool-calculator')
				);
			}

			await Promise.all(loadPromises);
			toolsLoaded = true;
		})();
	});

	// Registry-driven per-tool visibility
	let showTTS = $derived(visibleToolIds.includes('textToSpeech') && effectiveTTSService && toolsLoaded);
	let showAnswerEliminator = $derived(
		visibleToolIds.includes('answerEliminator') && effectiveToolCoordinator && toolsLoaded
	);
	let showCalculator = $derived(visibleToolIds.includes('calculator') && effectiveToolCoordinator && toolsLoaded);

	// Track answer eliminator visibility state
	let calculatorVisible = $state(false);
	let answerEliminatorVisible = $state(false);

	// Subscribe to tool coordinator to update button state
	$effect(() => {
		if (!isBrowser || !effectiveToolCoordinator) return;

		const unsubscribe = effectiveToolCoordinator.subscribe(() => {
			const nextCalculatorVisible = effectiveToolCoordinator.isToolVisible(`calculator-${itemId}`);
			const nextVisible = effectiveToolCoordinator.isToolVisible(`answerEliminator-${itemId}`);
			if (nextCalculatorVisible !== calculatorVisible) {
				calculatorVisible = nextCalculatorVisible;
			}
			if (nextVisible !== answerEliminatorVisible) {
				answerEliminatorVisible = nextVisible;
			}
		});

		// Initial update
		const initialCalculatorVisible = effectiveToolCoordinator.isToolVisible(`calculator-${itemId}`);
		const initialVisible = effectiveToolCoordinator.isToolVisible(`answerEliminator-${itemId}`);
		if (initialCalculatorVisible !== calculatorVisible) {
			calculatorVisible = initialCalculatorVisible;
		}
		if (initialVisible !== answerEliminatorVisible) {
			answerEliminatorVisible = initialVisible;
		}

		return unsubscribe;
	});

	// Answer eliminator element reference for scope binding
	let answerEliminatorElement = $state<HTMLElement | null>(null);
	let boundScopeElement = $state<HTMLElement | null>(null);
	let boundGlobalElementId = $state<string | null>(null);
	let boundElementToolStore = $state<unknown>(null);
	const effectiveScopeElement = $derived.by(() => {
		if (scopeElement) return scopeElement;
		if (!toolbarRootElement) return null;
		const shellRoot = toolbarRootElement.closest("[data-pie-shell-root]") as HTMLElement | null;
		if (!shellRoot) return null;
		return (
			(shellRoot.querySelector('[data-region="content"]') as HTMLElement | null) ||
			(shellRoot.querySelector('[data-pie-region="content"]') as HTMLElement | null) ||
			(shellRoot.querySelector('[data-region="header"]') as HTMLElement | null) ||
			(shellRoot.querySelector('[data-pie-region="header"]') as HTMLElement | null) ||
			shellRoot
		);
	});

	// Bind scope, coordinator, store, and globalElementId to answer eliminator
	$effect(() => {
		if (answerEliminatorElement) {
			if (effectiveScopeElement && boundScopeElement !== effectiveScopeElement) {
				(answerEliminatorElement as any).scopeElement = effectiveScopeElement;
				boundScopeElement = effectiveScopeElement;
			}
			if (
				effectiveElementToolStateStore &&
				globalElementId &&
				(boundElementToolStore !== effectiveElementToolStateStore ||
					boundGlobalElementId !== globalElementId)
			) {
				(answerEliminatorElement as any).elementToolStateStore = effectiveElementToolStateStore;
				(answerEliminatorElement as any).globalElementId = globalElementId;
				boundElementToolStore = effectiveElementToolStateStore;
				boundGlobalElementId = globalElementId;
			}
		}
	});

	// Handle answer eliminator toggle
	function toggleAnswerEliminator() {
		if (!effectiveToolCoordinator) return;
		effectiveToolCoordinator.toggleTool(`answerEliminator-${itemId}`);
	}

	const answerEliminatorButtonMeta = $derived.by(() => {
		if (!toolContext) return null;
		const tool = effectiveToolRegistry.get('answerEliminator');
		if (!tool) return null;
		return tool.createButton(toolContext, {
			onClick: toggleAnswerEliminator
		});
	});

	function resolveIconMarkup(icon: string | undefined): string {
		if (!icon) return '';
		if (icon.startsWith('<svg')) return icon;
		if (icon === 'strikethrough') {
			return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"/></svg>';
		}
		return '';
	}
</script>

{#if isBrowser}
	<div class="item-toolbar {className} item-toolbar--{size}" bind:this={toolbarRootElement}>
		<!-- Calculator Button (inline tool) -->
		{#if showCalculator}
			<pie-tool-calculator-inline
				tool-id="calculator-inline-{itemId}"
				calculator-type="scientific"
				available-types="basic,scientific,graphing"
				size={size}
			></pie-tool-calculator-inline>
			<pie-tool-calculator
				visible={calculatorVisible}
				tool-id="calculator-{itemId}"
			></pie-tool-calculator>
		{/if}

		<!-- TTS Button (inline tool) -->
		{#if showTTS}
			<pie-tool-tts-inline
				tool-id="tts-{itemId}"
				catalog-id={catalogId || itemId}
				language={language}
				size={size}
			></pie-tool-tts-inline>
		{/if}

		<!-- Answer Eliminator Toggle Button -->
		{#if showAnswerEliminator}
			<button
				type="button"
				class="item-toolbar__button"
				class:item-toolbar__button--active={answerEliminatorVisible}
				onclick={() => handleToolClick('answerEliminator')}
				aria-label={answerEliminatorButtonMeta?.ariaLabel || 'Answer Eliminator'}
				aria-pressed={answerEliminatorVisible}
				title={answerEliminatorButtonMeta?.tooltip || answerEliminatorButtonMeta?.label || 'Answer Eliminator'}
			>
				{@html resolveIconMarkup(answerEliminatorButtonMeta?.icon)}
			</button>

			<!-- Answer Eliminator Tool Instance (hidden, manages state) -->
			<pie-tool-answer-eliminator
				bind:this={answerEliminatorElement}
				visible={answerEliminatorVisible}
				tool-id="answerEliminator-{itemId}"
				strategy="strikethrough"
				button-alignment="inline"
				coordinator={effectiveToolCoordinator}
			></pie-tool-answer-eliminator>
		{/if}
	</div>
{/if}

<style>
	.item-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.item-toolbar__button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0.25rem;
		border: 1px solid var(--pie-border, #ccc);
		border-radius: 0.25rem;
		background-color: var(--pie-background, white);
		color: var(--pie-text, #333);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.item-toolbar--sm .item-toolbar__button {
		width: 2.75rem;
		height: 2.75rem;
	}

	.item-toolbar--lg .item-toolbar__button {
		width: 2.5rem;
		height: 2.5rem;
	}

	.item-toolbar__button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.item-toolbar__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.item-toolbar__button--active {
		background-color: var(--pie-primary, #1976d2);
		color: white;
		border-color: var(--pie-primary, #1976d2);
	}

	.item-toolbar__button--active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.item-toolbar__button:focus-visible {
		outline: 2px solid var(--pie-primary, #1976d2);
		outline-offset: 2px;
	}

	.item-toolbar__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.item-toolbar__button :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
