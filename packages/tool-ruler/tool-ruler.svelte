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
	let controlsEl = $state<HTMLDivElement | undefined>();

	/** Where the ruler sits; it turns about its centre, the default pivot. */
	const placement = createOverlayPlacement({
		getElement: () => containerEl,
		getControls: () => controlsEl,
		bringToFront: (element) => coordinator?.bringToFront(element),
		announce: (key, params) => announce(interfaceI18n.t(key, params)),
	});

	const registration = createToolCoordinatorRegistration('Ruler', ZIndexLayer.TOOL);

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

	// The placement keys, plus U to switch units.
	function handleKeyDown(e: KeyboardEvent) {
		if (placement.handleKeyDown(e)) return;
		if (e.key === 'u' || e.key === 'U') {
			toggleUnit();
			e.preventDefault();
		}
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
		class="pie-tool-ruler"
		data-pie-tool-id={toolId}
		onpointerdown={placement.startDrag}
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

		<OverlayRotateHandle controller={placement} classPrefix="pie-tool-ruler" />
		<OverlayPlacementControls
			controller={placement}
			i18n={interfaceI18n}
			classPrefix="pie-tool-ruler"
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

