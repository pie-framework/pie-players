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
		createToolCoordinatorRegistration,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';
	import { createOverlayPlacement } from '@pie-players/pie-players-shared';
	import {
		OverlayPlacementControls,
		OverlayRotateHandle,
	} from '@pie-players/pie-players-shared/components/overlay-placement';
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
	let controlsEl = $state<HTMLDivElement | undefined>();

	/**
	 * The vertex the protractor turns about sits this far above its bottom edge,
	 * on the baseline of the scale. `transform-origin` and the pivot marker in the
	 * stylesheet use the same inset.
	 */
	const VERTEX_INSET = 10;

	/** Where the protractor sits; it turns about its vertex. */
	const placement = createOverlayPlacement({
		getElement: () => containerEl,
		getControls: () => controlsEl,
		pivot: (size) => ({ x: size.width / 2, y: size.height - VERTEX_INSET }),
		// The marker sits on the vertex, which a turn about the vertex leaves in
		// place, so its box is the pivot on screen at any rotation.
		getScreenPivot: () => {
			const vertex = pivotEl?.getBoundingClientRect();
			return vertex && { x: vertex.left, y: vertex.top };
		},
		bringToFront: (element) => coordinator?.bringToFront(element),
		announce: (key, params) => announce(interfaceI18n.t(key, params)),
	});

	const registration = createToolCoordinatorRegistration('Protractor', ZIndexLayer.TOOL);

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

	// Each reveal mounts a fresh panel centred by its stylesheet, so the placement
	// starts over with it.
	$effect(() => {
		if (visible && containerEl && isBrowser) {
			// Wait for the next tick to ensure DOM is updated
			setTimeout(() => placement.show(), 0);
		} else {
			placement.reset();
		}
	});

	// Re-registers when a republished context brings a new coordinator.
	$effect(() => registration.sync(coordinator, toolId));

	onMount(() => {
		const disconnect = placement.connect();
		return () => {
			disconnect();
			registration.release();
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
		onpointerdown={placement.startDrag}
		onkeydown={placement.handleKeyDown}
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
		<OverlayRotateHandle controller={placement} classPrefix="pie-tool-protractor" />
		<OverlayPlacementControls
			controller={placement}
			i18n={interfaceI18n}
			classPrefix="pie-tool-protractor"
			bind:element={controlsEl}
		/>
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

