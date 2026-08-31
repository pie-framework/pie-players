<svelte:options
	customElement={{
		tag: 'pie-tool-protractor',
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
	import {
		clampOffsetWithinBlock,
		resolveContainingBlockRect
	} from '@pie-players/pie-players-shared';
	import MoveableModule from 'moveable';
	import { onMount } from 'svelte';
	import protractorSvg from './protractor.svg';

	/**
	 * The slice of Moveable's surface this tool uses.
	 *
	 * `moveable` publishes CJS with ESM-shaped declarations and no `exports` map, so
	 * under `moduleResolution: NodeNext` TypeScript resolves the default import to
	 * the module namespace rather than to the class: `new Moveable(...)` reads as
	 * not constructable and `Moveable` cannot be used as a type. Vite loads the ESM
	 * build, where the import *is* the class, so this describes runtime rather than
	 * changing it.
	 */
	interface MoveableInstance {
		bounds: {
			left: number;
			top: number;
			right: number;
			bottom: number;
			position?: 'css' | 'client';
		};
		destroy(): void;
		updateRect(): void;
		getControlBoxElement(): HTMLElement;
		on(
			event: 'drag' | 'rotate',
			handler: (payload: { target: HTMLElement; transform: string }) => void,
		): void;
	}
	const MoveableCtor = MoveableModule as unknown as new (
		container: HTMLElement,
		options: Record<string, unknown>,
	) => MoveableInstance;

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
	let moveable: MoveableInstance | null = null;

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

		moveable = new MoveableCtor(document.body, {
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
				left: -110,
				top: -110,
				right: -110,
				bottom: -110,
				position: 'css'
			};
			moveable.updateRect();
		}
	}

	/**
	 * Keeps a keyboard move inside the box this tool is positioned against. Pointer
	 * drags are bounded by Moveable; a keyboard move writes `style.transform`
	 * directly, so it needs the same bound applied here.
	 */
	function clampOffset(offset: { x: number; y: number }) {
		const block = resolveContainingBlockRect(containerEl);
		if (!block || !containerEl) return offset;
		const box = containerEl.getBoundingClientRect();
		return clampOffsetWithinBlock(offset, box, block);
	}

	// Keyboard navigation (preserved for accessibility)
	function handleKeyDown(e: KeyboardEvent) {
		if (!moveable || !containerEl) return;

		let handled = false;
		const isShift = e.shiftKey;

		/*
		 * Read the current placement from the computed transform rather than from the
		 * inline string. `DOMMatrix` rejects a value it cannot resolve at parse time,
		 * and the inline transform carries the `translate(-50%, -50%)` that centres
		 * the tool, so parsing it threw on every press after the first. The computed
		 * value is a resolved matrix.
		 *
		 * That matrix includes the centring, which is half the tool's own layout box,
		 * so adding it back leaves the offset this tool has actually been moved by --
		 * 0 before the first drag or nudge, and Moveable's offset after a drag. A
		 * viewport-derived fallback here is what made the first arrow key a jump to
		 * the middle of the screen.
		 */
		const computed = isBrowser ? getComputedStyle(containerEl).transform : 'none';
		const matrix = new DOMMatrix(computed === 'none' ? undefined : computed);
		let x = matrix.e + containerEl.offsetWidth / 2;
		let y = matrix.f + containerEl.offsetHeight / 2;
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
		}

		if (handled && moveable) {
			e.preventDefault();
			// Apply new transform via Moveable
			const contained = clampOffset({ x, y });
			containerEl.style.transform = `translate(-50%, -50%) translate(${contained.x}px, ${contained.y}px) rotate(${rotation}deg)`;
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
		window.addEventListener('resize', updateBounds);
		return () => {
			destroyMoveable();
			window.removeEventListener('resize', updateBounds);
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
		onpointerdown={() => containerEl && coordinator?.bringToFront(containerEl)}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.protractor.toolA11y')}
		aria-roledescription={interfaceI18n.t('tools.protractor.roleA11y')}
	>
		<div class="pie-tool-protractor__container">
			<img
				class="pie-tool-protractor__image"
				src={protractorSvg}
				alt={interfaceI18n.t('tools.protractor.imageAlt')}
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

	.pie-tool-protractor:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, var(--pie-primary, #4A90E2));
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

	/* Moveable.js control styling (matching production implementation) */
	:global(body .moveable-control-box[data-pie-tool-surface="frameless"]) {
		--moveable-color: transparent;
		z-index: 2003; /* ZIndexLayer.CONTROL */
	}

	:global([data-moveablejs-tool-id="protractor"]) {
		z-index: 2002; /* ZIndexLayer.MODAL */
	}
</style>

