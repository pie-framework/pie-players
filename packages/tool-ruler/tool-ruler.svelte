<svelte:options
	customElement={{
		tag: 'pie-tool-ruler',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">
	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import Moveable from 'moveable';
	import { onDestroy, onMount } from 'svelte';
	import rulerCm from './ruler-cm.svg';
	import rulerInches from './ruler-inches.svg';

	// Props
	let { visible = false, toolId = 'ruler' }: { visible?: boolean; toolId?: string } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	// Interface locale. Re-derives on every context republish, so a label rendered
	// before the catalog loaded is replaced rather than pinned.
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	let announceText = $state('');
	let unit = $state<'inches' | 'cm'>('inches');
	let moveable: Moveable | null = null;

	// Track registration state
	let registered = $state(false);

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const ROTATE_STEP = 5; // degrees
	const FINE_ROTATE_STEP = 1; // degrees

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	let currentRuler = $derived(unit === 'inches' ? rulerInches : rulerCm);

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	function toggleUnit() {
		unit = unit === 'inches' ? 'cm' : 'inches';
		announce(
			interfaceI18n.t('tools.ruler.switchedTo', {
				unit: interfaceI18n.t(unitNameInSentenceKey(unit)),
			}),
		);
	}

	/**
	 * The unit name as it reads inside a sentence, not as a standalone label.
	 * `tools.ruler.inches` is the button's Title Case form; interpolating it
	 * into "Switched to {unit}" would announce "Switched to Inches".
	 */
	function unitNameInSentenceKey(current: string) {
		return current === 'inches'
			? 'tools.ruler.inchesInSentence'
			: 'tools.ruler.centimetersInSentence';
	}

	/** The unit as the accessible name and the image alt spell it. */
	function unitAbbrevKey(current: string) {
		return current === 'inches'
			? 'tools.ruler.inchesAbbrev'
			: 'tools.ruler.centimetersAbbrev';
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
		const surface = containerEl.getAttribute('data-pie-tool-surface');
		if (surface) {
			controlBox?.setAttribute('data-pie-tool-surface', surface);
		}

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
					announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
				} else {
					y -= MOVE_STEP;
					announce(
						interfaceI18n.t('toolkit.announce.movedUp', { position: Math.round(y) }),
					);
				}
				handled = true;
				break;
			case 'ArrowDown':
				if (isShift) {
					rotation = (rotation + ROTATE_STEP) % 360;
					announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
				} else {
					y += MOVE_STEP;
					announce(
						interfaceI18n.t('toolkit.announce.movedDown', { position: Math.round(y) }),
					);
				}
				handled = true;
				break;
			case 'ArrowLeft':
				if (isShift) {
					rotation = (rotation - ROTATE_STEP + 360) % 360;
					announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
				} else {
					x -= MOVE_STEP;
					announce(
						interfaceI18n.t('toolkit.announce.movedLeft', { position: Math.round(x) }),
					);
				}
				handled = true;
				break;
			case 'ArrowRight':
				if (isShift) {
					rotation = (rotation + ROTATE_STEP) % 360;
					announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
				} else {
					x += MOVE_STEP;
					announce(
						interfaceI18n.t('toolkit.announce.movedRight', { position: Math.round(x) }),
					);
				}
				handled = true;
				break;
			case 'PageUp':
				rotation = (rotation - FINE_ROTATE_STEP + 360) % 360;
				announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
				handled = true;
				break;
			case 'PageDown':
				rotation = (rotation + FINE_ROTATE_STEP) % 360;
				announce(interfaceI18n.t('toolkit.announce.rotatedTo', { degrees: rotation }));
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
	<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="pie-tool-ruler"
		data-moveablejs-tool-id={toolId}
		onpointerdown={() => coordinator?.bringToFront(containerEl)}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.ruler.applicationA11y', {
			unit: interfaceI18n.t(unitAbbrevKey(unit)),
		})}
		aria-roledescription={interfaceI18n.t('tools.ruler.toolA11y')}
	>
		<div class="pie-tool-ruler__container">
			<img
				class="pie-tool-ruler__image"
				src={currentRuler}
				alt={interfaceI18n.t('tools.ruler.imageAlt', {
					unit: interfaceI18n.t(unitAbbrevKey(unit)),
				})}
				draggable="false"
			/>

			<!-- Unit toggle button group (matching production implementation style) -->
			<div
				class="pie-tool-ruler__unit-group"
				role="group"
				aria-label={interfaceI18n.t('tools.ruler.unitSelectionA11y')}
				onpointerdown={(e) => e.stopPropagation()}
			>
				<button
					class="pie-tool-ruler__unit-button"
					class:pie-tool-ruler__unit-button--active={unit === 'inches'}
					onclick={() => {
						unit = 'inches';
						announce(
							interfaceI18n.t('tools.ruler.switchedTo', {
								unit: interfaceI18n.t('tools.ruler.inchesInSentence'),
							}),
						);
					}}
					title={interfaceI18n.t('tools.ruler.inches')}
					aria-label={interfaceI18n.t('tools.ruler.switchToInchesA11y')}
					aria-pressed={unit === 'inches'}
				>
					<span class="pie-tool-ruler__unit-label">{interfaceI18n.t('tools.ruler.inches')}</span>
				</button>
				<button
					class="pie-tool-ruler__unit-button"
					class:pie-tool-ruler__unit-button--active={unit === 'cm'}
					onclick={() => {
						unit = 'cm';
						announce(
							interfaceI18n.t('tools.ruler.switchedTo', {
								unit: interfaceI18n.t('tools.ruler.centimetersInSentence'),
							}),
						);
					}}
					title={interfaceI18n.t('tools.ruler.centimeters')}
					aria-label={interfaceI18n.t('tools.ruler.switchToCentimetersA11y')}
					aria-pressed={unit === 'cm'}
				>
					<span class="pie-tool-ruler__unit-label">{interfaceI18n.t('tools.ruler.centimeters')}</span>
				</button>
			</div>
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

	.pie-tool-ruler {
		border-left: none;
		border-right: none;
		box-shadow: none;
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

	.pie-tool-ruler:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2));
		outline-offset: 2px;
	}

	.pie-tool-ruler__container {
		background-color: color-mix(in srgb, var(--pie-background, #fff) 90%, transparent); /* Matching production implementation semi-transparent white background */
		position: relative;
	}

	.pie-tool-ruler__container,
	.pie-tool-ruler__image {
		height: 100px; /* Matching production implementation ruler height */
		width: 864px; /* Matching production implementation ruler width */
	}

	.pie-tool-ruler__image {
		position: relative;
		z-index: 2;
		display: block;
	}

	/* Unit toggle button group (matching production implementation style) */
	.pie-tool-ruler__unit-group {
		border: 1px solid var(--pie-primary, #3f51b5); /* Matching production implementation primary color */
		bottom: 0.5rem; /* Matching production implementation positioning */
		left: 0.5rem; /* Matching production implementation positioning */
		position: absolute;
		display: flex;
		z-index: 10;
		background: var(--pie-background, #fff);
		border-radius: 4px;
		overflow: hidden;
	}

	.pie-tool-ruler__unit-button {
		background: var(--pie-button-bg, #fff);
		border: none;
		border-right: 1px solid var(--pie-primary, #3f51b5);
		color: var(--pie-button-color, var(--pie-primary, #3f51b5));
		cursor: pointer;
		padding: 4px 8px;
		font-size: 12px;
		transition: background-color 0.2s, color 0.2s;
	}

	.pie-tool-ruler__unit-button:last-child {
		border-right: none;
	}

	.pie-tool-ruler__unit-button:hover {
		background-color: var(--pie-button-hover-bg, color-mix(in srgb, var(--pie-primary, #3f51b5) 10%, transparent));
	}

	.pie-tool-ruler__unit-button.pie-tool-ruler__unit-button--active {
		background-color: var(--pie-primary, #3f51b5);
		color: var(--pie-white, #fff);
	}

	.pie-tool-ruler__unit-button:focus-visible {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: 2px;
	}

	.pie-tool-ruler__unit-label {
		display: inline-block;
		font-size: 12px;
		line-height: 1.4;
	}

	/* Moveable.js control styling (matching production implementation) */
	/* Production implementation uses black (--moveable-color: #000) globally, not red for ruler */
	:global(body .moveable-control-box[data-pie-tool-surface="frameless"]) {
		--moveable-color: transparent;
		z-index: 2003; /* ZIndexLayer.CONTROL */
	}

	:global([data-moveablejs-tool-id="ruler"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

