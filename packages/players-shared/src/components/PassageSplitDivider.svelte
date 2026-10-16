<!--
  Resize handle between the item player's passage and its item.

  The shape of the section player's `SectionCardSplitDivider`: pointer drag with
  container-relative math, keyboard operation, `role="separator"`, Escape
  restoring the width a drag started from, and a 24px pointer target. `value` is
  the passage's share of the player width.
-->
<script lang="ts">
	import {
		PASSAGE_SPLIT_MAX_PERCENT,
		PASSAGE_SPLIT_MIN_PERCENT,
		passageSplitPercentFromDrag,
		passageSplitPercentFromKey,
	} from "./passage-split-layout.js";

	let {
		value,
		container,
		ariaLabel,
		ariaControls,
		ariaValueText,
		onresize,
	}: {
		value: number;
		/** The element whose width a drag is measured against. */
		container: HTMLElement | null;
		ariaLabel: string;
		ariaControls: string;
		ariaValueText: string;
		onresize: (value: number) => void;
	} = $props();

	let dragging = $state(false);
	let startX = 0;
	let startValue = 0;
	let startWidth = 0;
	let rtl = false;

	function isRtl(): boolean {
		return (
			!!container && getComputedStyle(container).direction === "rtl"
		);
	}

	function beginDrag(event: PointerEvent) {
		if (event.button !== 0 && event.pointerType === "mouse") return;
		event.preventDefault();
		dragging = true;
		startX = event.clientX;
		startValue = value;
		startWidth = container?.getBoundingClientRect().width ?? 0;
		rtl = isRtl();
		(event.currentTarget as HTMLElement)?.setPointerCapture?.(event.pointerId);
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging) return;
		onresize(
			passageSplitPercentFromDrag({
				startPercent: startValue,
				deltaX: event.clientX - startX,
				containerWidthPx: startWidth,
				rtl,
			}),
		);
	}

	function endDrag() {
		dragging = false;
	}

	function cancelDrag() {
		if (!dragging) return;
		dragging = false;
		onresize(startValue);
	}

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			if (!dragging) return;
			event.preventDefault();
			cancelDrag();
			return;
		}
		const next = passageSplitPercentFromKey({
			key: event.key,
			percent: value,
			rtl: isRtl(),
		});
		if (next === undefined) return;
		event.preventDefault();
		onresize(next);
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
	class={`pie-item-player-split-divider ${dragging ? "pie-item-player-split-divider--dragging" : ""}`}
	role="separator"
	aria-orientation="vertical"
	aria-label={ariaLabel}
	aria-controls={ariaControls}
	aria-valuemin={PASSAGE_SPLIT_MIN_PERCENT}
	aria-valuemax={PASSAGE_SPLIT_MAX_PERCENT}
	aria-valuenow={Math.round(value)}
	aria-valuetext={ariaValueText}
	tabindex="0"
	onpointerdown={beginDrag}
	onkeydown={onKeyDown}
>
	<span class="pie-item-player-split-divider-handle"></span>
</div>

<style>
	.pie-item-player-split-divider {
		align-self: stretch;
		position: relative;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		/* A 24px pointer target around a 4px visible handle. */
		min-width: 24px;
		cursor: col-resize;
		background: transparent;
		user-select: none;
		touch-action: none;
	}

	/* The visible rule runs the full height, so the split reads as two panes. */
	.pie-item-player-split-divider::before {
		content: "";
		position: absolute;
		inset-block: 0;
		inset-inline-start: 50%;
		width: 1px;
		transform: translateX(-50%);
		background: var(--pie-border-light, #e5e7eb);
	}

	.pie-item-player-split-divider:focus {
		outline: none;
	}

	.pie-item-player-split-divider:focus-visible {
		outline: 3px solid var(--pie-focus-outline, #146eb3);
		outline-offset: -2px;
		border-radius: 999px;
	}

	/* Sticky, so the grip stays in reach beside a passage taller than the
	   viewport. */
	.pie-item-player-split-divider-handle {
		position: sticky;
		top: 1rem;
		margin-block-start: 1rem;
		width: 4px;
		height: 48px;
		border-radius: 2px;
		background: var(--pie-border-gray, #6b7280);
		transition: background 0.2s ease;
		pointer-events: none;
	}

	.pie-item-player-split-divider:hover .pie-item-player-split-divider-handle,
	.pie-item-player-split-divider:focus-visible .pie-item-player-split-divider-handle,
	.pie-item-player-split-divider--dragging .pie-item-player-split-divider-handle {
		background: var(--pie-focus-outline, #146eb3);
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-item-player-split-divider-handle {
			transition: none;
		}
	}
</style>
