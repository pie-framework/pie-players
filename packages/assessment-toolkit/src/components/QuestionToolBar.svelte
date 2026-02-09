<svelte:options
	customElement={{
		tag: 'pie-question-toolbar',
		shadow: 'none',
		props: {
			itemId: { type: 'String', attribute: 'item-id' },
			catalogId: { type: 'String', attribute: 'catalog-id' },
			tools: { type: 'String', attribute: 'tools' },
			size: { type: 'String', attribute: 'size' },
			language: { type: 'String', attribute: 'language' },

			// Services (passed as JS properties, not attributes)
			ttsService: { type: 'Object', reflect: false },
			toolCoordinator: { type: 'Object', reflect: false },
			highlightCoordinator: { type: 'Object', reflect: false },
			scopeElement: { type: 'Object', reflect: false },
			elementToolStateStore: { type: 'Object', reflect: false },

			// IDs for element-level state (passed as JS properties, not attributes)
			assessmentId: { type: 'String', reflect: false },
			sectionId: { type: 'String', reflect: false }
		}
	}}
/>

<!--
  QuestionToolBar - Inline toolbar for question/passage headers

  Displays tool buttons (TTS, Answer Eliminator, etc.) in a compact,
  horizontal layout suitable for embedding in question headers.

  Similar to the SchoolCity pattern where tool buttons appear next to
  question titles rather than in a global sidebar.
-->
<script lang="ts">
	import type {
		IToolCoordinator,
		ITTSService,
		IHighlightCoordinator,
	} from '../services/interfaces';

	// NOTE: Tool web components must be imported by parent components
	// that use QuestionToolBar (to avoid circular dependencies).
	// Parent components should:
	//   import '@pie-players/pie-tool-answer-eliminator';
	//   import '@pie-players/pie-tool-tts-inline';

	const isBrowser = typeof window !== 'undefined';

	/**
	 * Detect if the scoped element contains compatible answer choices for the answer eliminator.
	 * Checks for PIE multiple-choice, EBSR, and inline-dropdown elements.
	 */
	function hasCompatibleAnswerChoices(element: HTMLElement): boolean {
		// Check for multiple-choice elements
		const hasMultipleChoice = element.querySelector('.corespring-checkbox, .corespring-radio-button, .multiple-choice');
		if (hasMultipleChoice) return true;

		// Check for EBSR parts (extended constructed response with selectable parts)
		const hasEBSR = element.querySelector('[class*="ebsr"]');
		if (hasEBSR) return true;

		// Check for inline-dropdown elements
		const hasInlineDropdown = element.querySelector('inline-dropdown, .inline-dropdown, [class*="inline-dropdown"]');
		if (hasInlineDropdown) return true;

		return false;
	}

	// Props
	let {
		itemId = '',
		catalogId = '',
		tools = 'tts,answerEliminator',
		ttsService,
		toolCoordinator,
		highlightCoordinator,
		scopeElement = null,
		elementToolStateStore,
		assessmentId = '',
		sectionId = '',
		class: className = '',
		size = 'md' as 'sm' | 'md' | 'lg',
		language = 'en-US'
	}: {
		itemId?: string;
		catalogId?: string;
		tools?: string;
		ttsService?: ITTSService;
		toolCoordinator?: IToolCoordinator;
		highlightCoordinator?: IHighlightCoordinator;
		scopeElement?: HTMLElement | null;
		elementToolStateStore?: any;
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

	// Parse enabled tools
	let enabledTools = $derived(
		tools
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean),
	);

	// Detect if current item has compatible choices for answer eliminator
	let hasCompatibleChoices = $state(false);

	$effect(() => {
		if (!isBrowser || !scopeElement) {
			hasCompatibleChoices = false;
			return;
		}

		// Use MutationObserver to detect when PIE elements are rendered
		const checkChoices = () => {
			const hasChoices = hasCompatibleAnswerChoices(scopeElement);
			hasCompatibleChoices = hasChoices;
			console.debug('[QuestionToolBar] Checked choices:', {
				scopeElementTag: scopeElement.tagName,
				hasCompatibleChoices
			});
		};

		// Initial check
		checkChoices();

		// Watch for DOM changes (PIE elements load asynchronously)
		const observer = new MutationObserver(() => {
			checkChoices();
		});

		observer.observe(scopeElement, {
			childList: true,
			subtree: true
		});

		return () => observer.disconnect();
	});

	// Should show each tool
	let showTTS = $derived(enabledTools.includes('tts') && ttsService);
	let showAnswerEliminator = $derived(
		enabledTools.includes('answerEliminator') &&
		toolCoordinator &&
		hasCompatibleChoices
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
</script>

{#if isBrowser}
	<div class="question-toolbar {className} question-toolbar--{size}">
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
				onclick={toggleAnswerEliminator}
				aria-label="Answer Eliminator"
				aria-pressed={answerEliminatorVisible}
				title="Toggle answer elimination mode"
			>
				<!-- X in Circle Icon (matches SchoolCity) -->
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						d="M19,3H16.3H7.7H5A2,2 0 0,0 3,5V7.7V16.4V19A2,2 0 0,0 5,21H7.7H16.4H19A2,2 0 0,0 21,19V16.3V7.7V5A2,2 0 0,0 19,3M15.6,17L12,13.4L8.4,17L7,15.6L10.6,12L7,8.4L8.4,7L12,10.6L15.6,7L17,8.4L13.4,12L17,15.6L15.6,17Z"
					/>
				</svg>
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
		width: 1.5rem;
		height: 1.5rem;
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

	.question-toolbar__button svg {
		width: 100%;
		height: 100%;
	}
</style>
