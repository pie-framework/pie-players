<svelte:options
	customElement={{
		tag: 'pie-tool-protractor',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">
	import {
		assessmentToolkitRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import { ContextConsumer } from '@pie-players/pie-context';
	import Moveable from 'moveable';
	import { onMount } from 'svelte';
	import protractorSvg from './protractor.svg';

	// Props
	let { visible = false, toolId = 'protractor' }: { visible?: boolean; toolId?: string } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let runtimeContextConsumer: ContextConsumer<
		typeof assessmentToolkitRuntimeContext
	> | null = null;
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);
	let announceText = $state('');
	let moveable: Moveable | null = null;

	// Track registration state
	let registered = $state(false);

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const ROTATE_STEP = 5; // degrees
	const FINE_ROTATE_STEP = 1; // degrees

	$effect(() => {
		if (!containerEl) return;
		runtimeContextConsumer = new ContextConsumer(containerEl, {
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

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	// Initialize Moveable.js (matching production configuration)
	function initMoveable() {
		if (!containerEl || !isBrowser) {
			return;
		}

		// Clean up any existing instance first
		if (moveable) {
			moveable.destroy();
			moveable = null;
		}

		coordinator?.bringToFront(containerEl);

		moveable = new Moveable(document.body, {
			target: containerEl,
			draggable: true,
			rotatable: true,
			snappable: true,
			originDraggable: false,
			originRelative: true,
			origin: [0.5, 1], // Bottom center (matching production implementation)
			hideDefaultLines: true,
			keepRatio: false,
			bounds: {
				left: -110,
				top: -110,
				right: -110,
				bottom: -110,
				position: 'css'
			}
		} as any); // Type assertion needed for Moveable.js config

		// Associate the moveable instance with the tool ID
		const controlBox = moveable.getControlBoxElement();
		controlBox?.setAttribute('data-moveablejs-tool-control-box', toolId);

		moveable.on('drag', ({ target, transform }) => {
			if (target) {
				target.style.transform = transform;
			}
		});

		moveable.on('rotate', ({ target, transform }) => {
			if (target) {
				target.style.transform = transform;
			}
		});
	}

	function destroyMoveable() {
		if (moveable) {
			moveable.destroy();
			moveable = null;
		}
	}

	function updateBounds() {
		if (moveable) {
			moveable.bounds = {
				left: -110,
				top: -110,
				right: -110,
				bottom: -110,
				position: 'css'
			};
			moveable.updateRect();
		}
	}

	// Keyboard navigation (preserved for accessibility)
	function handleKeyDown(e: KeyboardEvent) {
		if (!moveable || !containerEl) return;

		let handled = false;
		const isShift = e.shiftKey;

		// Get current transform from element
		const transform = containerEl.style.transform || '';
		const matrix = new DOMMatrix(transform || 'none');
		
		// Extract position and rotation
		let x = matrix.e || (isBrowser ? window.innerWidth / 2 : 400);
		let y = matrix.f || (isBrowser ? window.innerHeight / 2 : 300);
		let rotation = Math.round(Math.atan2(matrix.b, matrix.a) * (180 / Math.PI));

		switch (e.key) {
			case 'ArrowUp':
				if (isShift) {
					rotation = (rotation - ROTATE_STEP + 360) % 360;
					announce(`Rotated to ${rotation} degrees`);
				} else {
					y -= MOVE_STEP;
					announce(`Moved up to ${Math.round(y)}`);
				}
				handled = true;
				break;
			case 'ArrowDown':
				if (isShift) {
					rotation = (rotation + ROTATE_STEP) % 360;
					announce(`Rotated to ${rotation} degrees`);
				} else {
					y += MOVE_STEP;
					announce(`Moved down to ${Math.round(y)}`);
				}
				handled = true;
				break;
			case 'ArrowLeft':
				if (isShift) {
					rotation = (rotation - ROTATE_STEP + 360) % 360;
					announce(`Rotated to ${rotation} degrees`);
				} else {
					x -= MOVE_STEP;
					announce(`Moved left to ${Math.round(x)}`);
				}
				handled = true;
				break;
			case 'ArrowRight':
				if (isShift) {
					rotation = (rotation + ROTATE_STEP) % 360;
					announce(`Rotated to ${rotation} degrees`);
				} else {
					x += MOVE_STEP;
					announce(`Moved right to ${Math.round(x)}`);
				}
				handled = true;
				break;
			case 'PageUp':
				rotation = (rotation - FINE_ROTATE_STEP + 360) % 360;
				announce(`Rotated to ${rotation} degrees`);
				handled = true;
				break;
			case 'PageDown':
				rotation = (rotation + FINE_ROTATE_STEP) % 360;
				announce(`Rotated to ${rotation} degrees`);
				handled = true;
				break;
		}

		if (handled && moveable) {
			e.preventDefault();
			// Apply new transform via Moveable
			const newTransform = `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`;
			containerEl.style.transform = newTransform;
			moveable.updateRect();
		}
	}

	// Initialize Moveable when visible changes
	$effect(() => {
		if (visible && containerEl && isBrowser) {
			// Wait for the next tick to ensure DOM is updated
			setTimeout(initMoveable, 0);
		} else {
			destroyMoveable();
		}
	});

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Protractor', undefined, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	onMount(() => {
		window.addEventListener('resize', updateBounds);
		return () => {
			destroyMoveable();
			window.removeEventListener('resize', updateBounds);
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// Auto-focus when tool becomes visible
	$effect(() => {
		if (visible && containerEl) {
			setTimeout(() => containerEl?.focus(), 100);
		}
	});
</script>

{#if visible && isBrowser}
	<!-- Screen reader announcements -->
	<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="pie-tool-protractor"
		data-moveablejs-tool-id={toolId}
		onpointerdown={() => coordinator?.bringToFront(containerEl)}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		aria-label="Protractor tool. Use arrow keys to move, Shift+arrows to rotate, PageUp/PageDown for fine rotation. Current rotation displayed via Moveable.js"
		aria-roledescription="Draggable and rotatable protractor measurement tool"
	>
		<div class="pie-tool-protractor__container">
			<img
				class="pie-tool-protractor__image"
				src={protractorSvg}
				alt="Protractor with 180-degree semicircular scale marked from 0 to 180 degrees in both directions, with degree markings every 10 degrees"
				draggable="false"
			/>
		</div>
	</div>
{/if}

<style>
	.pie-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.pie-tool-protractor {
		border: 0;
		cursor: move;
		left: 50%;
		overflow: hidden;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		transform-origin: 50% calc(100% - 10px); /* Rotation origin at bottom center (matching production implementation) */
		user-select: none;
		touch-action: none;
	}

	.pie-tool-protractor:focus {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.pie-tool-protractor:focus-visible {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.pie-tool-protractor__container {
		border: 0;
		position: relative;
		width: 400px;
		height: 210px;
	}

	/* Semi-transparent white overlay for visibility (matching production implementation) */
	.pie-tool-protractor__container::after {
		background-color: #fff;
		border-radius: 283px 283px 0 0;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* Matching production implementation shadow */
		content: '';
		display: block;
		height: 283px;
		opacity: 0.5;
		position: absolute;
		top: 0;
		width: 400px;
		z-index: 1;
		pointer-events: none;
	}

	.pie-tool-protractor__image {
		width: 400px;
		height: 210px;
		position: relative;
		z-index: 2;
		display: block;
	}

	/* Moveable.js control styling (matching production implementation) */
	:global(body .moveable-control-box[data-moveablejs-tool-control-box="protractor"]) {
		--moveable-color: red;
		z-index: 2003; /* ZIndexLayer.CONTROL */
	}

	:global([data-moveablejs-tool-id="protractor"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

