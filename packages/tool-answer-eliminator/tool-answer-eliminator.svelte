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
			coordinator: { type: 'Object' }
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
	
	import type { IToolCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';
import { onDestroy, onMount } from 'svelte';
	import { AnswerEliminatorCore } from './answer-eliminator-core';

	// Props
	let {
		visible = false,
		toolId = 'answerEliminator',
		strategy = 'strikethrough' as 'strikethrough' | 'mask' | 'gray',
		alwaysOn = false, // Set true for profile-based accommodation
		buttonAlignment = 'right' as 'left' | 'right' | 'inline', // Button placement: left, right, or inline with checkbox
		coordinator
	}: {
		visible?: boolean;
		toolId?: string;
		strategy?: 'strikethrough' | 'mask' | 'gray';
		alwaysOn?: boolean;
		buttonAlignment?: 'left' | 'right' | 'inline';
		coordinator?: IToolCoordinator;
	} = $props();

	// State
	let core = $state<AnswerEliminatorCore | null>(null);
	let eliminatedCount = $state(0);
	let mutationObserver = $state<MutationObserver | null>(null);

	// Track registration state
	let registered = $state(false);

	// Determine if tool should be active (either toggled on OR always-on mode)
	let isActive = $derived(alwaysOn || visible);

	function initializeForCurrentQuestion() {
		if (!isActive || !core) return;

		// Find the current question/item in the assessment player
		const questionRoot =
			document.querySelector('pie-player') ||
			document.querySelector('multiple-choice') ||
			document.querySelector('ebsr') ||
			document.querySelector('[data-pie-element]') ||
			document.body;

		if (!questionRoot) {
			console.warn('[AnswerEliminator] Could not find question root');
			return;
		}

		core.initializeForQuestion(questionRoot as HTMLElement);
		updateEliminatedCount();
	}

	function waitForPIEElements(callback: () => void, timeout: number = 5000) {
		// Check if PIE elements already exist
		const checkElements = () => {
			const questionRoot =
				document.querySelector('pie-player') ||
				document.querySelector('multiple-choice') ||
				document.querySelector('ebsr') ||
				document.querySelector('[data-pie-element]');

			if (questionRoot) {
				// Elements found, clean up observer and execute callback
				if (mutationObserver) {
					mutationObserver.disconnect();
					mutationObserver = null;
				}
				callback();
				return true;
			}
			return false;
		};

		// Try immediately first
		if (checkElements()) return;

		// Set up MutationObserver to watch for elements
		mutationObserver = new MutationObserver(() => {
			checkElements();
		});

		// Observe the body for added nodes
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true
		});

		// Fallback timeout to prevent infinite observation
		setTimeout(() => {
			if (mutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
				// Try one last time
				checkElements();
			}
		}, timeout);
	}

	function handleItemChange() {
		// Question changed, wait for PIE elements to be rendered using MutationObserver
		waitForPIEElements(() => {
			initializeForCurrentQuestion();
		});
	}

	function updateEliminatedCount() {
		eliminatedCount = core?.getEliminatedCount() || 0;
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Answer Eliminator', undefined, ZIndexLayer.MODAL);
			registered = true;
		}
	});

	onMount(() => {
		// Initialize core engine with configuration
		core = new AnswerEliminatorCore(strategy, buttonAlignment);

		// Listen for question changes (PIE player emits this)
		document.addEventListener('pie-item-changed', handleItemChange);

		// Listen for custom events from answer-eliminator-core when state changes
		document.addEventListener('answer-eliminator-state-change', () => {
			updateEliminatedCount();
		});

		// Initialize for current question if active, otherwise ensure clean state
		if (isActive) {
			// Wait for PIE elements to be mounted using MutationObserver
			waitForPIEElements(() => {
				initializeForCurrentQuestion();
			});
		} else {
			// If not active on mount, clear any leftover visual eliminations
			core.cleanup();
		}

		return () => {
			// Clean up MutationObserver if still active
			if (mutationObserver) {
				mutationObserver.disconnect();
				mutationObserver = null;
			}

			core?.destroy();
			core = null;
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
			document.removeEventListener('pie-item-changed', handleItemChange);
			document.removeEventListener('answer-eliminator-state-change', updateEliminatedCount);
		};
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
