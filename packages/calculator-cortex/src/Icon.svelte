<script lang="ts">
	/**
	 * A glyph face for a button whose accessible name is its `aria-label`.
	 *
	 * `aria-hidden` and `focusable="false"`: the icon is not content, and an SVG left
	 * focusable is a tab stop with nothing to do in it.
	 */
	import { ICON_STROKE, ICON_VIEW_BOX } from './icons.js';

	let { paths }: { paths: readonly string[] } = $props();
</script>

<svg
	class="pie-cortex-icon"
	viewBox={ICON_VIEW_BOX}
	aria-hidden="true"
	focusable="false"
	{...ICON_STROKE}
>
	{#each paths as d (d)}<path {d} />{/each}
</svg>

<style>
	/*
	 * `em`, so the icon tracks the type size of the button it sits in rather than
	 * pinning a pixel size that a 1.4.12 text-spacing override or a host font scale
	 * would leave behind.
	 */
	.pie-cortex-icon {
		display: block;
		width: 1.375em;
		height: 1.375em;
	}
</style>
