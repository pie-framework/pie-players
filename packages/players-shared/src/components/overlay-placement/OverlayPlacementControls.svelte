<!--
  Tap alternatives to dragging a placed tool (WCAG 2.5.7), shown while the tool
  has focus. A press keeps focus on the tool, so the controls stay up. The
  controller docks them past the tool's bottom edge; they are laid out while
  hidden so it can measure them. Carries `{classPrefix}__controls` and
  `{classPrefix}__control` beside its own classes, so each tool keeps its
  selectors.
-->
<script lang="ts">
	import type { I18nProvider } from '@pie-players/pie-players-shared/i18n/types';
	import {
		OVERLAY_PLACEMENT_NUDGES,
		OVERLAY_PLACEMENT_ROTATIONS,
		type OverlayPlacementController,
		type OverlayPlacementNudge,
	} from '@pie-players/pie-players-shared';

	let {
		controller,
		i18n,
		classPrefix,
		element = $bindable(),
	}: {
		controller: OverlayPlacementController;
		i18n: I18nProvider;
		classPrefix: string;
		element?: HTMLDivElement;
	} = $props();
</script>

<div
	bind:this={element}
	class="pie-tool-placement__controls {classPrefix}__controls"
	role="group"
	aria-label={i18n.t('toolkit.placement.controlsA11y')}
	onpointerdown={(e) => {
		e.stopPropagation();
		e.preventDefault();
	}}
>
	{#each Object.entries(OVERLAY_PLACEMENT_NUDGES) as [direction, control] (direction)}
		<button
			type="button"
			class="pie-tool-placement__control {classPrefix}__control"
			aria-label={i18n.t(control.labelKey)}
			onclick={() => controller.nudge(direction as OverlayPlacementNudge)}
		><span aria-hidden="true">{control.glyph}</span></button>
	{/each}
	<span class="pie-tool-placement__controls-divider" aria-hidden="true"></span>
	{#each OVERLAY_PLACEMENT_ROTATIONS as degrees (degrees)}
		<button
			type="button"
			class="pie-tool-placement__control {classPrefix}__control"
			aria-label={i18n.t(
				degrees > 0
					? 'toolkit.placement.rotateClockwiseA11y'
					: 'toolkit.placement.rotateCounterclockwiseA11y',
				{ degrees: Math.abs(degrees) }
			)}
			onclick={() => controller.rotateBy(degrees)}
		><span aria-hidden="true">{degrees > 0 ? '↻' : '↺'}{Math.abs(degrees)}°</span></button>
	{/each}
</div>

<style>
	.pie-tool-placement__controls {
		align-items: center;
		background: var(--pie-background, #fff);
		border: 1px solid var(--pie-border-light, #cbd5e0);
		border-radius: 8px;
		box-shadow: 0 2px 6px color-mix(in srgb, var(--pie-black, #000) 15%, transparent);
		cursor: default;
		/* Arrows and turn glyphs are physical directions, whatever the script. */
		direction: ltr;
		display: flex;
		gap: 4px;
		left: 0;
		padding: 4px;
		position: absolute;
		top: 0;
		visibility: hidden;
		white-space: nowrap;
	}

	/* The tool is the controls' parent. */
	:global(:focus-within) > .pie-tool-placement__controls {
		visibility: visible;
	}

	.pie-tool-placement__control {
		align-items: center;
		background: var(--pie-button-bg, var(--pie-background, #fff));
		border: 1px solid var(--pie-button-border, var(--pie-border, #94a3b8));
		border-radius: 6px;
		color: var(--pie-button-color, var(--pie-text, #111827));
		cursor: pointer;
		display: inline-flex;
		font: inherit;
		font-size: 14px;
		justify-content: center;
		min-height: 32px;
		min-width: 32px;
		padding: 0 6px;
	}

	.pie-tool-placement__control:hover {
		background: var(--pie-button-hover-bg, var(--pie-background-dark, #f3f5f7));
	}

	.pie-tool-placement__control:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, var(--pie-primary, #4a90e2));
		outline-offset: 1px;
	}

	.pie-tool-placement__controls-divider {
		align-self: stretch;
		background: var(--pie-border-light, #cbd5e0);
		margin: 0 2px;
		width: 1px;
	}
</style>
