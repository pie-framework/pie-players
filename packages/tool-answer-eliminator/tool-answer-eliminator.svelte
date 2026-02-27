<svelte:options
	customElement={{
		tag: 'pie-tool-answer-eliminator',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			strategy: { type: 'String', attribute: 'strategy' },
			alwaysOn: { type: 'Boolean', attribute: 'always-on' },
			buttonAlignment: { type: 'String', attribute: 'button-alignment' },
			scopeElement: { type: 'Object', reflect: false },

			// Store integration (JS properties only)
			elementToolStateStore: { type: 'Object', reflect: false },
			globalElementId: { type: 'String', reflect: false }
		}
	}}
/>

<!-- Answer Eliminator Tool - Process-of-Elimination Support (Inline Toggle Mode)

  Allows students to mark answer choices as "eliminated" during test-taking,
  supporting the process-of-elimination strategy.

  **Interaction Pattern (Industry Standard):**
  - Student toggles tool ON via toolbar button
  - Small elimination buttons (X) appear next to each answer choice
  - Student clicks X buttons to eliminate/restore choices
  - Tool can be toggled OFF to hide all elimination buttons
  - OR can be "always-on" via student profile (alwaysOn prop)

  **Features:**
  - Modern CSS Custom Highlight API (zero DOM mutation, 10-15x faster)
  - Generic adapter pattern (works with multiple-choice, EBSR, inline-dropdown)
  - Strikethrough visual (WCAG 2.2 AA compliant, best for accessibility)
  - localStorage persistence across question navigation
  - Keyboard accessible with proper ARIA attributes

  **WCAG 2.2 Level AA Compliant:**
  - 1.3.1 Info and Relationships (maintains structure)
  - 2.4.3 Focus Order (no layout shift)
  - 3.3.1 Error Identification (easy to identify/correct)
  - 4.1.2 Name, Role, Value (proper ARIA)
-->

<script lang="ts">
	
	import {
		assessmentToolkitRuntimeContext,
		connectAssessmentToolkitShellContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitShellContext,
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import { ContextConsumer } from '@pie-players/pie-context';
	import { onMount } from 'svelte';
	import { AnswerEliminatorCore } from './answer-eliminator-core.js';

	// Props
	let {
		visible = false,
		toolId = 'answerEliminator',
		strategy = 'strikethrough' as 'strikethrough' | 'mask' | 'gray',
		alwaysOn = false, // Set true for profile-based accommodation
		buttonAlignment = 'right' as 'left' | 'right' | 'inline', // Button placement: left, right, or inline with checkbox
		scopeElement = null, // Container element to limit DOM queries (for multi-item pages)

		// Store integration
		elementToolStateStore = null, // ElementToolStateStore instance
		globalElementId = '' // Composite key: "assessmentId:sectionId:itemId:elementId"
	}: {
		visible?: boolean;
		toolId?: string;
		strategy?: 'strikethrough' | 'mask' | 'gray';
		alwaysOn?: boolean;
		buttonAlignment?: 'left' | 'right' | 'inline';
		scopeElement?: HTMLElement | null;
		elementToolStateStore?: any;
		globalElementId?: string;
	} = $props();

	// State
	let contextHostElement = $state<HTMLElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	let runtimeContextConsumer: ContextConsumer<
		typeof assessmentToolkitRuntimeContext
	> | null = null;
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);
	let core = $state<AnswerEliminatorCore | null>(null);
	let lastShellContextVersion = $state<number | null>(null);

	// Track registration state
	let registered = $state(false);

	// Determine if tool should be active (either toggled on OR always-on mode)
	let isActive = $derived(alwaysOn || visible);

	$effect(() => {
		if (!contextHostElement) return;
		runtimeContextConsumer = new ContextConsumer(contextHostElement, {
			context: assessmentToolkitRuntimeContext,
			subscribe: true,
			onValue: (value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		});
		runtimeContextConsumer.connect();
		return () => {
			runtimeContextConsumer?.disconnect();
			runtimeContextConsumer = null;
		};
	});

	$effect(() => {
		if (!contextHostElement) return;
		return connectAssessmentToolkitShellContext(contextHostElement, (value: AssessmentToolkitShellContext) => {
			shellContext = value;
		});
	});

	function resolveQuestionRoot(): HTMLElement | null {
		return scopeElement || shellContext?.scopeElement || null;
	}

	function initializeForCurrentQuestion() {
		if (!isActive || !core) return;
		const questionRoot = resolveQuestionRoot();

		if (!questionRoot) {
			console.warn('[AnswerEliminator] Missing shell scope context for question root');
			return;
		}

		core.initializeForQuestion(questionRoot);
	}

	function handleItemChange() {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				initializeForCurrentQuestion();
			});
		});
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Answer Eliminator', undefined, ZIndexLayer.MODAL);
			registered = true;
		}
	});

	// Update store integration when store props change
	$effect(() => {
		if (core && elementToolStateStore && globalElementId) {
			core.setStoreIntegration(elementToolStateStore, globalElementId);
		}
	});

	onMount(() => {
		// Initialize core engine with configuration
		core = new AnswerEliminatorCore(strategy, buttonAlignment);

		// Set up store integration if provided
		if (core && elementToolStateStore && globalElementId) {
			core.setStoreIntegration(elementToolStateStore, globalElementId);
		}

		// Initialize for current question if active, otherwise ensure clean state
		if (isActive) {
			initializeForCurrentQuestion();
		} else {
			// If not active on mount, clear any leftover visual eliminations
			core.cleanup();
		}

		return () => {
			core?.destroy();
			core = null;
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	$effect(() => {
		const shellVersion = shellContext?.contextVersion ?? null;
		if (shellVersion === null) return;
		if (lastShellContextVersion === null) {
			lastShellContextVersion = shellVersion;
			return;
		}
		if (shellVersion === lastShellContextVersion) return;
		lastShellContextVersion = shellVersion;
		handleItemChange();
	});

	// Watch for visibility changes to show/hide elimination buttons
	$effect(() => {
		if (core) {
			if (isActive) {
				// Re-enable state restoration when tool is activated
				core.enableStateRestoration();
				initializeForCurrentQuestion();
			} else {
				// Hide all elimination buttons when tool is turned off
				// This also disables state restoration
				core.cleanup();
			}
		}
	});
</script>

<!-- No visible UI - tool operates entirely through injected buttons next to choices -->
<!-- The toolbar button visibility is managed by tool-toolbar.svelte -->
<div bind:this={contextHostElement} style="display: none;" aria-hidden="true"></div>
