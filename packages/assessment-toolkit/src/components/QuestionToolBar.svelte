<svelte:options
	customElement={{
		tag: 'pie-question-toolbar',
		shadow: 'none',
		props: {
			itemId: { type: 'String', attribute: 'item-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			tools: { type: 'String', attribute: 'tools' },
			contentKind: { type: 'String', attribute: 'content-kind' },
			size: { type: 'String', attribute: 'size' },
			language: { type: 'String', attribute: 'language' },

			// Services (passed as JS properties, not attributes)
			ttsService: { type: 'Object', reflect: false },
			toolCoordinator: { type: 'Object', reflect: false },
			highlightCoordinator: { type: 'Object', reflect: false },
			scopeElement: { type: 'Object', reflect: false },
			elementToolStateStore: { type: 'Object', reflect: false },
			toolRegistry: { type: 'Object', reflect: false },
			pnpResolver: { type: 'Object', reflect: false },
			assessment: { type: 'Object', reflect: false },
			itemRef: { type: 'Object', reflect: false },
			item: { type: 'Object', reflect: false },

			// IDs for element-level state (passed as JS properties, not attributes)
			assessmentId: { type: 'String', reflect: false },
			sectionId: { type: 'String', reflect: false }
		}
	}}
/>

<!--
  QuestionToolBar - Inline toolbar for question/passage headers

  Button visibility is always registry-driven:
  - Pass 1: allowed tool IDs (PNP resolver when available, otherwise explicit tools prop)
  - Pass 2: tool-owned isVisibleInContext(context)
-->
<script lang="ts">
	import type {
		IToolCoordinator,
		ITTSService,
		IHighlightCoordinator,
	} from '../services/interfaces.js';
	import type { ToolRegistry } from '../services/ToolRegistry.js';
	import type { PNPToolResolver } from '../services/PNPToolResolver.js';
	import { createDefaultToolRegistry } from '../services/createDefaultToolRegistry.js';
	import type {
		AssessmentEntity,
		AssessmentItemRef,
		ItemEntity,
	} from '@pie-players/pie-players-shared/types';
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
		ttsService,
		toolCoordinator,
		highlightCoordinator,
		scopeElement = null,
		elementToolStateStore,
		toolRegistry = null,
		pnpResolver = null,
		assessment = null,
		itemRef = null,
		item = null,
		assessmentId = '',
		sectionId = '',
		class: className = '',
		size = 'md' as 'sm' | 'md' | 'lg',
		language = 'en-US'
	}: {
		itemId?: string;
		catalogId?: string;
		tools?: string;
		contentKind?: string;
		ttsService?: ITTSService;
		toolCoordinator?: IToolCoordinator;
		highlightCoordinator?: IHighlightCoordinator;
		scopeElement?: HTMLElement | null;
		elementToolStateStore?: any;
		toolRegistry?: ToolRegistry | null;
		pnpResolver?: PNPToolResolver | null;
		assessment?: AssessmentEntity | null;
		itemRef?: AssessmentItemRef | null;
		item?: ItemEntity | null;
		assessmentId?: string;
		sectionId?: string;
		class?: string;
		size?: 'sm' | 'md' | 'lg';
		language?: string;
	} = $props();

	// Generate globalElementId using store utility
	let globalElementId = $derived.by(() => {
		if (!elementToolStateStore || !assessmentId || !sectionId || !itemId) return null;
		return elementToolStateStore.getGlobalElementId(assessmentId, sectionId, itemId, itemId);
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
			.filter(Boolean),
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
			item,
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
				elementId: model.id as string,
			}));
	});

	// Pass 2: tool-owned context filtering (item + element aggregation)
	const visibleToolIds = $derived.by(() => {
		const visible = new Set<string>();
		if (toolContext) {
			effectiveToolRegistry
				.filterVisibleInContext(allowedToolIds, toolContext)
				.forEach((tool) => visible.add(tool.toolId));
		}

		for (const context of elementContexts) {
			effectiveToolRegistry
				.filterVisibleInContext(allowedToolIds, context)
				.forEach((tool) => visible.add(tool.toolId));
		}

		return Array.from(visible);
	});

	// Handle tool click (activates tool)
	async function handleToolClick(toolId: string) {
		console.log('[QuestionToolBar] Tool clicked:', toolId);

		if (!toolCoordinator) {
			console.warn('[QuestionToolBar] No toolCoordinator available');
			return;
		}

		// Registry-owned lazy module loading before tool activation.
		if (effectiveToolRegistry) {
			await effectiveToolRegistry.ensureToolModuleLoaded(toolId);
		}

		// Toggle tool visibility
		const fullToolId = `${toolId}-${itemId}`;
		toolCoordinator.toggleTool(fullToolId);
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
	let showTTS = $derived(
		visibleToolIds.includes('textToSpeech') &&
		ttsService &&
		toolsLoaded
	);
	let showAnswerEliminator = $derived(
		visibleToolIds.includes('answerEliminator') &&
		toolCoordinator &&
		toolsLoaded
	);
	let showCalculator = $derived(
		visibleToolIds.includes('calculator') &&
		toolCoordinator &&
		toolsLoaded
	);

	// Track answer eliminator visibility state
	let answerEliminatorVisible = $state(false);

	// Subscribe to tool coordinator to update button state
	$effect(() => {
		if (!isBrowser || !toolCoordinator) return;

		const unsubscribe = toolCoordinator.subscribe(() => {
			answerEliminatorVisible = toolCoordinator.isToolVisible(
				`answerEliminator-${itemId}`,
			);
		});

		// Initial update
		answerEliminatorVisible = toolCoordinator.isToolVisible(
			`answerEliminator-${itemId}`,
		);

		return unsubscribe;
	});

	// TTS element reference for service binding
	let ttsToolElement = $state<HTMLElement | null>(null);
	let ttsBound = $state(false);

	// Bind services to TTS tool
	$effect(() => {
		if (ttsToolElement && !ttsBound) {
			if (toolCoordinator) {
				(ttsToolElement as any).coordinator = toolCoordinator;
			}
			if (ttsService) {
				(ttsToolElement as any).ttsService = ttsService;
			}
			if (highlightCoordinator) {
				(ttsToolElement as any).highlightCoordinator = highlightCoordinator;
			}
			ttsBound = true;
		}
	});

	// Answer eliminator element reference for scope binding
	let answerEliminatorElement = $state<HTMLElement | null>(null);
	let eliminatorBound = $state(false);

	// Bind scope, coordinator, store, and globalElementId to answer eliminator
	$effect(() => {
		if (answerEliminatorElement && !eliminatorBound) {
			if (toolCoordinator) {
				(answerEliminatorElement as any).coordinator = toolCoordinator;
			}
			if (scopeElement) {
				(answerEliminatorElement as any).scopeElement = scopeElement;
			}
			if (elementToolStateStore && globalElementId) {
				(answerEliminatorElement as any).elementToolStateStore = elementToolStateStore;
				(answerEliminatorElement as any).globalElementId = globalElementId;
			}
			eliminatorBound = true;
		}
	});

	// Handle answer eliminator toggle
	function toggleAnswerEliminator() {
		if (!toolCoordinator) return;
		toolCoordinator.toggleTool(`answerEliminator-${itemId}`);
	}

	const answerEliminatorButtonMeta = $derived.by(() => {
		if (!toolContext) return null;
		const tool = effectiveToolRegistry.get('answerEliminator');
		if (!tool) return null;
		return tool.createButton(toolContext, {
			onClick: toggleAnswerEliminator,
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

	// Calculator element reference for coordinator binding
	let calculatorInlineElement = $state<HTMLElement | null>(null);
	let calculatorBound = $state(false);

	// Bind coordinator to calculator inline tool
	$effect(() => {
		if (calculatorInlineElement && !calculatorBound) {
			if (toolCoordinator) {
				(calculatorInlineElement as any).coordinator = toolCoordinator;
			}
			calculatorBound = true;
		}
	});
</script>

{#if isBrowser}
	<div class="question-toolbar {className} question-toolbar--{size}">
		<!-- Calculator Button (inline tool) -->
		{#if showCalculator}
			<pie-tool-calculator-inline
				bind:this={calculatorInlineElement}
				tool-id="calculator-inline-{itemId}"
				calculator-type="scientific"
				available-types="basic,scientific,graphing"
				size={size}
			></pie-tool-calculator-inline>
		{/if}

		<!-- TTS Button (inline tool) -->
		{#if showTTS}
			<pie-tool-tts-inline
				bind:this={ttsToolElement}
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
				class="question-toolbar__button"
				class:question-toolbar__button--active={answerEliminatorVisible}
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
				coordinator={toolCoordinator}
			></pie-tool-answer-eliminator>
		{/if}
	</div>
{/if}

<style>
	.question-toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.question-toolbar__button {
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

	.question-toolbar--sm .question-toolbar__button {
		width: 2.75rem;  /* 44px - WCAG 2.5.2 Level A minimum */
		height: 2.75rem;
	}

	.question-toolbar--lg .question-toolbar__button {
		width: 2.5rem;
		height: 2.5rem;
	}

	.question-toolbar__button:hover:not(:disabled) {
		background-color: var(
			--pie-secondary-background,
			#f5f5f5
		);
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.question-toolbar__button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: none;
	}

	.question-toolbar__button--active {
		background-color: var(--pie-primary, #1976d2);
		color: white;
		border-color: var(--pie-primary, #1976d2);
	}

	.question-toolbar__button--active:hover:not(:disabled) {
		background-color: var(--pie-primary-dark, #1565c0);
	}

	.question-toolbar__button:focus-visible {
		outline: 2px solid var(--pie-primary, #1976d2);
		outline-offset: 2px;
	}

	.question-toolbar__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.question-toolbar__button :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
