<script lang="ts">
	/**
	 * Resize handle between an item card's content and its media region.
	 *
	 * Follows `SectionSplitDivider.svelte`'s shape — pointer drag, keyboard
	 * accessible, `role="separator"`, percentage-bounded — rather than reusing
	 * it: that component is wired to the passage/items grid, hardcoded to one
	 * orientation, and converts a drag with a fixed 0.1%-per-pixel factor.
	 * Inside a card, the same drag has to mean the same thing whether the card
	 * is wide or narrow, so the math here is container-relative.
	 *
	 * `value` is the *media region's* share of the card width, and the region
	 * sits on the right, so left grows it — for both pointer and keyboard.
	 */
	import {
		clampMediaRegionPercent,
		mediaRegionPercentFromDrag,
	} from "./card-media-region.js";

	let {
		value = 34,
		min = 20,
		max = 55,
		step = 5,
		container = null as HTMLElement | null,
		ariaLabel = "Resize media region",
		ariaControls = "",
		ariaValueText = "",
		onresize = (_value: number, _input: "pointer" | "keyboard") => {},
	} = $props<{
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		container?: HTMLElement | null;
		ariaLabel?: string;
		ariaControls?: string;
		ariaValueText?: string;
		onresize?: (value: number, input: "pointer" | "keyboard") => void;
	}>();

	let dragging = $state(false);
	let startX = 0;
	let startValue = 0;
	let startWidth = 0;
	let valueBeforeDrag = 0;

	function beginDrag(event: PointerEvent) {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		event.preventDefault();
		dragging = true;
		startX = event.clientX;
		startValue = value;
		valueBeforeDrag = value;
		startWidth = container?.getBoundingClientRect().width ?? 0;
		(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		onresize(
			mediaRegionPercentFromDrag({
				startPercent: startValue,
				deltaX: event.clientX - startX,
				containerWidthPx: startWidth,
				min,
				max,
			}),
			"pointer",
		);
	}

	function endDrag() {
		if (!dragging) return;
		dragging = false;
	}

	function cancelDrag() {
		if (!dragging) return;
		dragging = false;
		onresize(clampMediaRegionPercent(valueBeforeDrag, min, max), "pointer");
	}

	function onKeyDown(event: KeyboardEvent) {
		if (
			event.key !== "ArrowLeft" &&
			event.key !== "ArrowRight" &&
			event.key !== "Home" &&
			event.key !== "End" &&
			event.key !== "Escape"
		) {
			return;
		}
		event.preventDefault();
		if (event.key === "Escape") {
			cancelDrag();
			return;
		}
		let next = value;
		// Home/End follow the visual extremes of the handle, not of `value`:
		// dragging the handle to the far left is the widest media region.
		if (event.key === "Home") next = max;
		else if (event.key === "End") next = min;
		else {
			next = clampMediaRegionPercent(
				value + (event.key === "ArrowLeft" ? step : -step),
				min,
				max,
			);
		}
		onresize(next, "keyboard");
	}

	$effect(() => {
		if (!dragging || typeof window === "undefined") return;
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", endDrag);
		window.addEventListener("pointercancel", cancelDrag);
		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", endDrag);
			window.removeEventListener("pointercancel", cancelDrag);
		};
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={`pie-section-player-card-split-divider ${dragging ? "pie-section-player-card-split-divider--dragging" : ""}`}
	role="separator"
	aria-orientation="vertical"
	aria-label={ariaLabel}
	aria-controls={ariaControls || undefined}
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={Math.round(value)}
	aria-valuetext={ariaValueText || undefined}
	tabindex="0"
	onpointerdown={beginDrag}
	onkeydown={onKeyDown}
>
	<span class="pie-section-player-card-split-divider__handle"></span>
</div>

<style>
	.pie-section-player-card-split-divider {
		align-self: stretch;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		/* Wide enough for a 24px pointer target while the visible rule stays
		   hairline; the grid track is sized to match. */
		min-width: 24px;
		cursor: col-resize;
		background: transparent;
		user-select: none;
		touch-action: none;
	}

	.pie-section-player-card-split-divider:focus {
		outline: none;
	}

	.pie-section-player-card-split-divider:focus-visible {
		outline: 3px solid var(--pie-section-player-focus-outline, var(--pie-focus-outline, #146eb3));
		outline-offset: -2px;
		border-radius: 999px;
	}

	.pie-section-player-card-split-divider__handle {
		width: 4px;
		height: 48px;
		max-height: 60%;
		border-radius: 2px;
		background: var(--pie-border-light, #e5e7eb);
		transition: background 0.2s ease;
		pointer-events: none;
	}

	.pie-section-player-card-split-divider:hover .pie-section-player-card-split-divider__handle,
	.pie-section-player-card-split-divider:focus-visible .pie-section-player-card-split-divider__handle,
	.pie-section-player-card-split-divider--dragging .pie-section-player-card-split-divider__handle {
		background: var(--pie-section-player-focus-outline, var(--pie-focus-outline, #146eb3));
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-section-player-card-split-divider__handle {
			transition: none;
		}
	}
</style>
