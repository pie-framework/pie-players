<svelte:options
	customElement={{
		tag: 'pie-tool-protractor',
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
		rotatedExtent,
		rotationCentreShift
	} from '@pie-players/pie-players-shared';
	import { onMount } from 'svelte';
	import protractorSvg from './protractor.svg';

	// Props
	let { visible = false, toolId = 'protractor' }: { visible?: boolean; toolId?: string } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);
	// Interface locale, re-derived on every context republish.
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));
	let announceText = $state('');
	let pivotEl = $state<HTMLSpanElement | undefined>();
	let rotateHandleEl = $state<HTMLDivElement | undefined>();

	/**
	 * Where the protractor sits, as an offset from its centred position plus a
	 * rotation about its vertex. Plain `let`: the pointer and keyboard paths both
	 * write it and `applyPlacement` pushes it to `style.transform`, so nothing
	 * renders from it reactively.
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
	/** Pixels of the protractor kept inside its containing block on each axis. */
	const MIN_VISIBLE = 100;
	/**
	 * The vertex the protractor turns about sits this far above its bottom edge,
	 * on the baseline of the scale. `transform-origin` and the pivot marker in the
	 * stylesheet use the same inset.
	 */
	const VERTEX_INSET = 10;

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	/**
	 * Writes a placement to `style.transform`, first keeping part of the turned
	 * protractor inside the box it is positioned against. Pointer and keyboard
	 * both land here, so they share one bound, which lets the protractor overhang
	 * its card while `MIN_VISIBLE` keeps enough in view to grab it back.
	 *
	 * The protractor turns about its vertex, so its turned extent is centred off
	 * its translate offset by `rotationCentreShift`; the clamp bounds that centre.
	 */
	function applyPlacement(next: { x: number; y: number; rotation: number }) {
		if (!containerEl) return;
		const block = resolveContainingBlockRect(containerEl);
		const size = { width: containerEl.offsetWidth, height: containerEl.offsetHeight };
		const shift = rotationCentreShift(
			size,
			{ x: size.width / 2, y: size.height - VERTEX_INSET },
			next.rotation
		);
		const centre = { x: next.x + shift.x, y: next.y + shift.y };
		const bounded = block
			? clampOffsetOverlappingBlock(centre, rotatedExtent(size, next.rotation), block, MIN_VISIBLE)
			: centre;
		placement = { x: bounded.x - shift.x, y: bounded.y - shift.y, rotation: next.rotation };
		containerEl.style.transform = `translate(-50%, -50%) translate(${placement.x}px, ${placement.y}px) rotate(${placement.rotation}deg)`;
	}

	/** A resize can leave the protractor outside its shrunken containing block. */
	function reapplyPlacement() {
		applyPlacement(placement);
	}

	/**
	 * Claims a press for a drag or rotation. The claim's `preventDefault`
	 * suppresses the press's default focus, so focus the protractor here: the
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
		// The handle sits inside the protractor; its press must not also start a drag.
		e.stopPropagation();
		if (!containerEl || !rotateHandleEl || !pivotEl) return;
		coordinator?.bringToFront(containerEl);
		if (!claimGesture(e, rotateHandleEl)) return;
		// The marker sits on the vertex, which a turn about the vertex leaves in
		// place, so its box is the pivot on screen at any rotation.
		const vertex = pivotEl.getBoundingClientRect();
		rotateController.startRotating(e, rotateHandleEl, { x: vertex.left, y: vertex.top });
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
			coordinator.registerTool(toolId, 'Protractor', undefined, ZIndexLayer.TOOL);
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
		class="pie-tool-protractor"
		data-pie-tool-id={toolId}
		onpointerdown={handleDragStart}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.protractor.toolA11y')}
		aria-roledescription={interfaceI18n.t('tools.protractor.roleA11y')}
	>
		<div class="pie-tool-protractor__frame">
			<div class="pie-tool-protractor__container">
				<img
					class="pie-tool-protractor__image"
					src={protractorSvg}
					alt={interfaceI18n.t('tools.protractor.imageAlt')}
					draggable="false"
				/>
			</div>
		</div>

		<span bind:this={pivotEl} class="pie-tool-protractor__pivot" aria-hidden="true"></span>
		<!-- Pointer-only affordance: Shift+arrows and Page Up/Down rotate from the keyboard. -->
		<span class="pie-tool-protractor__rotate-line" aria-hidden="true"></span>
		<div
			bind:this={rotateHandleEl}
			class="pie-tool-protractor__rotate-handle"
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

	.pie-tool-protractor {
		border: 0;
		cursor: move;
		left: 50%;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		/* Turns about the vertex on the scale's baseline, VERTEX_INSET above the bottom. */
		transform-origin: 50% calc(100% - 10px);
		/* Touch drags move the protractor rather than scroll or zoom the page, and
		   a long press on iOS opens no callout or selection on the image. */
		touch-action: none;
		-webkit-touch-callout: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.pie-tool-protractor:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2));
		outline-offset: 2px;
	}

	/* Clips the semi-transparent backdrop, which is taller than the scale. */
	.pie-tool-protractor__frame {
		overflow: hidden;
	}

	/* A zero-size marker on the vertex, VERTEX_INSET above the bottom. */
	.pie-tool-protractor__pivot {
		bottom: 10px;
		height: 0;
		left: 50%;
		pointer-events: none;
		position: absolute;
		width: 0;
	}

	.pie-tool-protractor__rotate-line {
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
	.pie-tool-protractor__rotate-handle {
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

	.pie-tool-protractor__rotate-handle:active {
		cursor: grabbing;
	}

	.pie-tool-protractor__rotate-handle::after {
		background: var(--pie-background, #fff);
		border: 2px solid var(--pie-primary, #3f51b5);
		border-radius: 50%;
		box-sizing: border-box;
		content: '';
		height: 14px;
		width: 14px;
	}

	.pie-tool-protractor__container {
		border: 0;
		position: relative;
		width: 400px;
		height: 210px;
	}

	/* Semi-transparent white overlay for visibility (matching production implementation) */
	.pie-tool-protractor__container::after {
		background-color: var(--pie-background, #fff);
		border-radius: 283px 283px 0 0;
		box-shadow: none;
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

	:global([data-pie-tool-id="protractor"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

