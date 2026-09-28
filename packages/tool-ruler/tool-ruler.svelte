<svelte:options
	customElement={{
		tag: 'pie-tool-ruler',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script lang="ts">
	import { coerceBooleanAttributes } from '@pie-players/pie-players-shared/ui/attribute-coercion';
	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import {
		clampOffsetOverlappingBlock,
		createPointerDragController,
		createPointerGesture,
		createPointerRotateController,
		resolveContainingBlockRect,
		rotatedExtent
	} from '@pie-players/pie-players-shared';
	import { onMount } from 'svelte';
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
	let rotateHandleEl = $state<HTMLDivElement | undefined>();

	/**
	 * Where the ruler sits, as an offset from its centred position plus a rotation
	 * about its centre. Plain `let`: the pointer and keyboard paths both write it
	 * and `applyPlacement` pushes it to `style.transform`, so nothing renders from
	 * it reactively.
	 */
	let placement = { x: 0, y: 0, rotation: 0 };

	const dragController = createPointerDragController({
		getPosition: () => ({ x: placement.x, y: placement.y }),
		setPosition: (next) => applyPlacement({ ...placement, ...next })
	});
	const rotateController = createPointerRotateController({
		getRotation: () => placement.rotation,
		setRotation: (rotation) => applyPlacement({ ...placement, rotation })
	});
	const gesture = createPointerGesture({
		onMove: (e) => {
			dragController.handlePointerMove(e);
			rotateController.handlePointerMove(e);
		},
		onEnd: () => {
			dragController.endDragging();
			rotateController.endRotating();
		}
	});

	// The coordinator a registration was made against, and the id it used. Plain
	// `let` rather than `$state`: this is bookkeeping the registration effect both
	// reads and writes, and a reactive write inside a tracked effect body is what
	// AGENTS.md's Svelte Subscription Safety rules out.
	let registeredCoordinator: ToolCoordinatorApi | null = null;
	let registeredToolId: string | null = null;

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const ROTATE_STEP = 5; // degrees
	const FINE_ROTATE_STEP = 1; // degrees
	/** Pixels of the ruler kept inside its containing block on each axis. */
	const MIN_VISIBLE = 100;

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

	/**
	 * Writes a placement to `style.transform`, first keeping part of the turned
	 * ruler inside the box it is positioned against. Pointer and keyboard both
	 * land here, so they share one bound. It lets the ruler overhang: an item card
	 * is barely wider than the ruler, and full containment would pin its zero mark
	 * to the card's edge. The card clips what overhangs, so `MIN_VISIBLE` keeps
	 * enough in view to grab it back.
	 */
	function applyPlacement(next: { x: number; y: number; rotation: number }) {
		if (!containerEl) return;
		const block = resolveContainingBlockRect(containerEl);
		const box = rotatedExtent(
			{ width: containerEl.offsetWidth, height: containerEl.offsetHeight },
			next.rotation
		);
		const offset = block ? clampOffsetOverlappingBlock(next, box, block, MIN_VISIBLE) : next;
		placement = { x: offset.x, y: offset.y, rotation: next.rotation };
		containerEl.style.transform = `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) rotate(${placement.rotation}deg)`;
	}

	/** A resize can leave the ruler outside its shrunken containing block. */
	function reapplyPlacement() {
		applyPlacement(placement);
	}

	/**
	 * Claims a press for a drag or rotation. The claim's `preventDefault`
	 * suppresses the press's default focus, so focus the ruler here: the
	 * arrow-key alternatives act on it.
	 */
	function claimGesture(e: PointerEvent, target: HTMLElement) {
		if (!gesture.begin(e, target)) return false;
		containerEl?.focus({ preventScroll: true });
		return true;
	}

	function handleDragStart(e: PointerEvent) {
		if (!containerEl) return;
		coordinator?.bringToFront(containerEl);
		if (!claimGesture(e, containerEl)) return;
		dragController.startDragging(e, containerEl);
	}

	function handleRotateStart(e: PointerEvent) {
		// The handle sits inside the ruler; its press must not also start a drag.
		e.stopPropagation();
		if (!containerEl || !rotateHandleEl) return;
		coordinator?.bringToFront(containerEl);
		if (!claimGesture(e, rotateHandleEl)) return;
		const rect = containerEl.getBoundingClientRect();
		rotateController.startRotating(e, rotateHandleEl, {
			x: rect.left + rect.width / 2,
			y: rect.top + rect.height / 2
		});
	}

	// Keyboard navigation (preserved for accessibility)
	function handleKeyDown(e: KeyboardEvent) {
		if (!containerEl) return;

		let handled = false;
		const isShift = e.shiftKey;

		let { x, y } = placement;
		let rotation = Math.round(placement.rotation);

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

		if (handled) {
			e.preventDefault();
			applyPlacement({ x, y, rotation });
		}
	}

	// Each reveal mounts a fresh panel centred by its stylesheet, so the placement
	// starts over with it.
	$effect(() => {
		if (visible && containerEl && isBrowser) {
			// Wait for the next tick to ensure DOM is updated
			setTimeout(() => containerEl && coordinator?.bringToFront(containerEl), 0);
		} else {
			gesture.release();
			placement = { x: 0, y: 0, rotation: 0 };
		}
	});

	// Re-register whenever the coordinator identity or the tool id changes. The
	// coordinator arrives through a republished runtime context, so a new instance
	// replaces the old one mid-session; a one-shot registration would leave
	// z-index, `bringToFront` and visibility-restore bound to the dead coordinator.
	$effect(() => {
		if (!coordinator || !toolId) return;
		if (
			registeredCoordinator &&
			registeredToolId &&
			(registeredCoordinator !== coordinator || registeredToolId !== toolId)
		) {
			registeredCoordinator.unregisterTool(registeredToolId);
			registeredCoordinator = null;
			registeredToolId = null;
		}
		if (!registeredCoordinator) {
			coordinator.registerTool(toolId, 'Ruler', undefined, ZIndexLayer.TOOL);
			registeredCoordinator = coordinator;
			registeredToolId = toolId;
		}
	});

	onMount(() => {
		window.addEventListener('resize', reapplyPlacement);
		return () => {
			gesture.release();
			window.removeEventListener('resize', reapplyPlacement);
			// Unregister from the coordinator the registration was actually made
			// against, which is not necessarily the one currently in context.
			if (registeredCoordinator && registeredToolId) {
				registeredCoordinator.unregisterTool(registeredToolId);
				registeredCoordinator = null;
				registeredToolId = null;
			}
		};
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// Auto-focus when tool becomes visible. `preventScroll` so revealing the
	// tool cannot scroll the pane it sits in.
	$effect(() => {
		if (visible && containerEl) {
			setTimeout(() => containerEl?.focus({ preventScroll: true }), 100);
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
		data-pie-tool-id={toolId}
		onpointerdown={handleDragStart}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.ruler.applicationA11y', {
			unit: interfaceI18n.t(unitNameInSentenceKey(unit)),
		})}
		aria-roledescription={interfaceI18n.t('tools.ruler.toolA11y')}
	>
		<div class="pie-tool-ruler__frame">
		<div class="pie-tool-ruler__container">
			<img
				class="pie-tool-ruler__image"
				src={currentRuler}
				alt={interfaceI18n.t('tools.ruler.imageAlt', {
					unit: interfaceI18n.t(unitNameInSentenceKey(unit)),
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

		<!-- Pointer-only affordance: Shift+arrows and Page Up/Down rotate from the keyboard. -->
		<span class="pie-tool-ruler__rotate-line" aria-hidden="true"></span>
		<div
			bind:this={rotateHandleEl}
			class="pie-tool-ruler__rotate-handle"
			aria-hidden="true"
			onpointerdown={handleRotateStart}
		></div>
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
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		/* Touch drags move the ruler rather than scroll or zoom the page, and a
		   long press on iOS opens no callout or selection on the image. */
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
		width: 540px; /* Matching production implementation frame width */
	}

	.pie-tool-ruler:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2));
		outline-offset: 2px;
	}

	.pie-tool-ruler__frame {
		box-shadow: 0 0 0 1px var(--pie-primary, #3f51b5);
		overflow: hidden;
	}

	/* A frameless overlay draws its own surface, so the frame line goes. */
	:host([data-pie-tool-surface='frameless']) .pie-tool-ruler__frame {
		box-shadow: none;
	}

	.pie-tool-ruler__rotate-line {
		background: var(--pie-primary, #3f51b5);
		bottom: 100%;
		height: 40px;
		left: 50%;
		pointer-events: none;
		position: absolute;
		transform: translateX(-50%);
		width: 1px;
	}

	/* A 44px hit area centred on the 14px knob at the end of the line. */
	.pie-tool-ruler__rotate-handle {
		align-items: center;
		bottom: calc(100% + 40px - 22px);
		cursor: grab;
		display: flex;
		height: 44px;
		justify-content: center;
		left: 50%;
		position: absolute;
		touch-action: none;
		transform: translateX(-50%);
		width: 44px;
	}

	.pie-tool-ruler__rotate-handle:active {
		cursor: grabbing;
	}

	.pie-tool-ruler__rotate-handle::after {
		background: var(--pie-background, #fff);
		border: 2px solid var(--pie-primary, #3f51b5);
		border-radius: 50%;
		box-sizing: border-box;
		content: '';
		height: 14px;
		width: 14px;
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

	:global([data-pie-tool-id="ruler"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

