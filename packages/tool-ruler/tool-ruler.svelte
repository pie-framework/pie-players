<svelte:options
	customElement={{
		tag: 'pie-tool-ruler',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' },
			coordinator: { type: 'Object' }
		}
	}}
/>

<script lang="ts">
	import type { IToolCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { ZIndexLayer } from '@pie-players/pie-assessment-toolkit';
	import Moveable from 'moveable';
	import { onDestroy, onMount } from 'svelte';
	import rulerCm from './ruler-cm.svg';
	import rulerInches from './ruler-inches.svg';

	// Props
	let { visible = false, toolId = 'ruler', coordinator }: { visible?: boolean; toolId?: string; coordinator?: IToolCoordinator } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let announceText = $state('');
	let unit = $state<'inches' | 'cm'>('inches');
	let moveable: Moveable | null = null;

	// Track registration state
	let registered = $state(false);

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const ROTATE_STEP = 5; // degrees
	const FINE_ROTATE_STEP = 1; // degrees

	let currentRuler = $derived(unit === 'inches' ? rulerInches : rulerCm);

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	function toggleUnit() {
		unit = unit === 'inches' ? 'cm' : 'inches';
		announce(`Switched to ${unit === 'inches' ? 'inches' : 'centimeters'}`);
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
			originDraggable: true,
			originRelative: true,
			keepRatio: false,
			bounds: {
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
				position: 'css'
			}
		});

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
				left: 0,
				top: 0,
				right: 0,
				bottom: 0,
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
			case 'u':
			case 'U':
				toggleUnit();
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
			coordinator.registerTool(toolId, 'Ruler', undefined, ZIndexLayer.TOOL);
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
	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="ruler-frame"
		data-moveablejs-tool-id={toolId}
		onpointerdown={() => coordinator?.bringToFront(containerEl)}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		aria-label="Ruler tool. Use arrow keys to move, Shift+arrows to rotate, PageUp/PageDown for fine rotation, U to toggle units. Current unit: {unit}"
		aria-roledescription="Draggable and rotatable ruler measurement tool"
	>
		<div class="ruler-container">
			<img
				class="ruler"
				src={currentRuler}
				alt="Ruler showing {unit}"
				draggable="false"
			/>

			<!-- Unit toggle button group (matching production implementation style) -->
			<div class="btn-group" onpointerdown={(e) => e.stopPropagation()}>
				<button
					class="unit-btn"
					class:active={unit === 'inches'}
					onclick={() => {
						unit = 'inches';
						announce('Switched to inches');
					}}
					title="Inches"
					aria-label="Switch to inches"
					aria-pressed={unit === 'inches'}
				>
					<span class="btn-label">Inches</span>
				</button>
				<button
					class="unit-btn"
					class:active={unit === 'cm'}
					onclick={() => {
						unit = 'cm';
						announce('Switched to centimeters');
					}}
					title="Centimeters"
					aria-label="Switch to centimeters"
					aria-pressed={unit === 'cm'}
				>
					<span class="btn-label">Centimeters</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.sr-only {
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

	.ruler-frame {
		border-left: 1px solid #000;
		border-right: 1px solid #000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); /* Matching production implementation shadow */
		cursor: move;
		left: 50%;
		overflow: hidden;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		user-select: none;
		touch-action: none;
		width: 540px; /* Matching production implementation frame width */
	}

	.ruler-frame:focus {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.ruler-frame:focus-visible {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.ruler-container {
		background-color: rgb(255 255 255 / 90%); /* Matching production implementation semi-transparent white background */
		position: relative;
	}

	.ruler-container,
	.ruler {
		height: 100px; /* Matching production implementation ruler height */
		width: 864px; /* Matching production implementation ruler width */
	}

	.ruler {
		position: relative;
		z-index: 2;
		display: block;
	}

	/* Unit toggle button group (matching production implementation style) */
	.btn-group {
		border: 1px solid var(--pie-primary, #3f51b5); /* Matching production implementation primary color */
		bottom: 0.5rem; /* Matching production implementation positioning */
		left: 0.5rem; /* Matching production implementation positioning */
		position: absolute;
		display: flex;
		z-index: 10;
		background: white;
		border-radius: 4px;
		overflow: hidden;
	}

	.unit-btn {
		background: white;
		border: none;
		border-right: 1px solid var(--pie-primary, #3f51b5);
		color: var(--pie-primary, #3f51b5);
		cursor: pointer;
		padding: 4px 8px;
		font-size: 12px;
		transition: background-color 0.2s, color 0.2s;
	}

	.unit-btn:last-child {
		border-right: none;
	}

	.unit-btn:hover {
		background-color: rgba(63, 81, 181, 0.1);
	}

	.unit-btn.active {
		background-color: var(--pie-primary, #3f51b5);
		color: white;
	}

	.unit-btn:focus-visible {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: 2px;
	}

	.btn-label {
		display: inline-block;
		font-size: 12px;
		line-height: 1.4;
	}

	/* Moveable.js control styling (matching production implementation) */
	/* Production implementation uses black (--moveable-color: #000) globally, not red for ruler */
	:global(body .moveable-control-box[data-moveablejs-tool-control-box="ruler"]) {
		--moveable-color: #000; /* Black, matching production implementation default */
		z-index: 2003; /* ZIndexLayer.CONTROL */
	}

	:global([data-moveablejs-tool-id="ruler"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

