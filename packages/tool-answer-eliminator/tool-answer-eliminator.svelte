<svelte:options
	customElement={{
		tag: 'pie-tool-answer-eliminator',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			strategy: { type: 'String', attribute: 'strategy' },
			alwaysOn: { type: 'Boolean', attribute: 'always-on' },
			buttonAlignment: { type: 'String', attribute: 'button-alignment' },

			// Store key per PIE element, by model id (JS property only)
			elementStateKeys: { type: 'Object', reflect: false }
		},
		extend: coerceBooleanAttributes,
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
  - CSS Custom Highlight API, so struck text keeps its DOM nodes
  - Generic adapter pattern (works with multiple-choice, EBSR, inline-dropdown)
  - Strikethrough visual (WCAG 2.2 AA compliant, best for accessibility)
  - Eliminations persist across question navigation through the toolkit's element tool state store
  - Keyboard accessible with proper ARIA attributes

  **WCAG 2.2 Level AA Compliant:**
  - 1.3.1 Info and Relationships (maintains structure)
  - 2.4.3 Focus Order (no layout shift)
  - 3.3.1 Error Identification (easy to identify/correct)
  - 4.1.2 Name, Role, Value (proper ARIA)
-->

<script lang="ts">
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';
	
	import {
		connectToolRuntimeContext,
		connectToolShellContext,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import type {
		AssessmentToolkitShellContext,
		AssessmentToolkitRuntimeContext,
	} from '@pie-players/pie-assessment-toolkit/tools/registration';
	import { untrack } from 'svelte';
	import { AnswerEliminatorCore, type ElementStateKeys } from './answer-eliminator-core.js';

	let {
		visible = false,
		strategy = 'strikethrough' as 'strikethrough' | 'mask',
		alwaysOn = false, // Set true for profile-based accommodation
		buttonAlignment = 'right' as 'left' | 'right' | 'inline', // Button placement: left, right, or inline with checkbox
		elementStateKeys = {} as ElementStateKeys // Store key per PIE element, by model id
	}: {
		visible?: boolean;
		strategy?: 'strikethrough' | 'mask';
		alwaysOn?: boolean;
		buttonAlignment?: 'left' | 'right' | 'inline';
		elementStateKeys?: ElementStateKeys;
	} = $props();

	let contextHostElement = $state<HTMLElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let shellContext = $state<AssessmentToolkitShellContext | null>(null);
	// Where eliminations persist across question navigation.
	const elementToolStateStore = $derived(runtimeContext?.elementToolStateStore ?? null);
	let core = $state<AnswerEliminatorCore | null>(null);
	let lastShellContextVersion = $state<number | null>(null);

	// Determine if tool should be active (either toggled on OR always-on mode)
	let isActive = $derived(alwaysOn || visible);

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolRuntimeContext(contextHostElement, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		if (!contextHostElement) return;
		return connectToolShellContext(contextHostElement, (value: AssessmentToolkitShellContext) => {
			shellContext = value;
		});
	});

	function resolveQuestionRoot(): HTMLElement | null {
		return shellContext?.scopeElement || null;
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

	// Update store integration when the store or the element keys change
	$effect(() => {
		core?.setStoreIntegration(elementToolStateStore, elementStateKeys ?? {});
	});

	// The toolbar owns this tool's coordinator entry and passes its visibility in
	// `visible`. A strategy or alignment change rebuilds the core, which restores
	// the question's eliminations from the store.
	$effect(() => {
		const next = new AnswerEliminatorCore(strategy, buttonAlignment);
		untrack(() => {
			next.setStoreIntegration(elementToolStateStore, elementStateKeys ?? {});
			core = next;
			if (isActive) {
				initializeForCurrentQuestion();
			} else {
				next.cleanup();
			}
		});
		return () => {
			next.destroy();
			if (core === next) core = null;
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
