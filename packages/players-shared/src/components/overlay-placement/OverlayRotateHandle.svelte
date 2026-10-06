<!--
  The line and knob a pointer turns a placed tool with. Pointer-only:
  Shift+arrows, Page Up/Down and the tap controls turn it without one. Carries
  `{classPrefix}__rotate-line` and `{classPrefix}__rotate-handle` beside its
  own classes, so each tool keeps its selectors.
-->
<script lang="ts">
	import type { OverlayPlacementController } from '@pie-players/pie-players-shared';

	let {
		controller,
		classPrefix,
	}: {
		controller: OverlayPlacementController;
		classPrefix: string;
	} = $props();

	let handleEl = $state<HTMLDivElement | undefined>();
</script>

<span class="pie-tool-placement__rotate-line {classPrefix}__rotate-line" aria-hidden="true"></span>
<div
	bind:this={handleEl}
	class="pie-tool-placement__rotate-handle {classPrefix}__rotate-handle"
	aria-hidden="true"
	onpointerdown={(e) => handleEl && controller.startRotate(e, handleEl)}
></div>

<style>
	.pie-tool-placement__rotate-line {
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
	.pie-tool-placement__rotate-handle {
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

	.pie-tool-placement__rotate-handle:active {
		cursor: grabbing;
	}

	.pie-tool-placement__rotate-handle::after {
		background: var(--pie-background, #fff);
		border: 2px solid var(--pie-primary, #3f51b5);
		border-radius: 50%;
		box-sizing: border-box;
		content: '';
		height: 14px;
		width: 14px;
	}
</style>
