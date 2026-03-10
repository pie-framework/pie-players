<script lang="ts">
	import { createEventDispatcher } from "svelte";

	let {
		value = 50,
		min = 20,
		max = 80,
		step = 5,
		disabled = false,
		ariaLabel = "Resize panels",
		ariaControls = "",
		ariaValueText = "",
	} = $props<{
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		ariaLabel?: string;
		ariaControls?: string;
		ariaValueText?: string;
	}>();

	const dispatch = createEventDispatcher<{
		"resize-start": { value: number };
		"resize-preview": { value: number; input: "pointer" | "keyboard" };
		"resize-commit": { value: number; input: "pointer" | "keyboard" };
		"resize-cancel": { value: number };
	}>();

	let dragging = $state(false);
	let startX = 0;
	let startValue = 0;

	function clamp(next: number): number {
		return Math.max(min, Math.min(max, next));
	}

	function startDrag(event: MouseEvent) {
		if (disabled) return;
		event.preventDefault();
		dragging = true;
		startX = event.clientX;
		startValue = value;
		dispatch("resize-start", { value });
	}

	function onMouseMove(event: MouseEvent) {
		if (!dragging) return;
		const deltaPx = event.clientX - startX;
		// Divider math stays in wrappers; here we emit a bounded percentage hint.
		const next = clamp(startValue + deltaPx * 0.1);
		dispatch("resize-preview", { value: next, input: "pointer" });
	}

	function onMouseUp() {
		if (!dragging) return;
		dragging = false;
		dispatch("resize-commit", { value, input: "pointer" });
	}

	function onKeyDown(event: KeyboardEvent) {
		if (disabled) return;
		if (
			event.key !== "ArrowLeft" &&
			event.key !== "ArrowRight" &&
			event.key !== "Escape" &&
			event.key !== "Home" &&
			event.key !== "End"
		) {
			return;
		}
		event.preventDefault();
		if (event.key === "Escape") {
			dispatch("resize-cancel", { value });
			return;
		}
		let next = value;
		if (event.key === "Home") {
			next = min;
		} else if (event.key === "End") {
			next = max;
		} else {
			const delta = event.key === "ArrowLeft" ? -step : step;
			next = clamp(value + delta);
		}
		dispatch("resize-preview", { value: next, input: "keyboard" });
		dispatch("resize-commit", { value: next, input: "keyboard" });
	}

	$effect(() => {
		if (!dragging) return;
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
		return () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};
	});
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class={`pie-section-player-split-divider ${dragging ? "pie-section-player-split-divider--dragging" : ""}`}
	role="separator"
	aria-orientation="vertical"
	aria-label={ariaLabel}
	aria-controls={ariaControls || undefined}
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={Math.round(value)}
	aria-valuetext={ariaValueText || undefined}
	aria-disabled={disabled ? "true" : undefined}
	tabindex={disabled ? undefined : 0}
	onmousedown={startDrag}
	onkeydown={onKeyDown}
>
	<span class="pie-section-player-split-divider-handle"></span>
</div>

<style>
	.pie-section-player-split-divider {
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		align-self: stretch;
		height: 100%;
		min-height: 0;
		position: relative;
		cursor: col-resize;
		background: var(--pie-secondary-background, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
		transition: background 0.2s ease;
	}

	.pie-section-player-split-divider:hover {
		background: var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-split-divider:focus {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: -2px;
	}

	.pie-section-player-split-divider-handle {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 6px;
		height: 60px;
		background: var(--pie-blue-grey-600, #9ca3af);
		border-radius: 3px;
		transition: all 0.2s ease;
		pointer-events: none;
	}

	.pie-section-player-split-divider-handle::before {
		content: "";
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 2px;
		height: 20px;
		background: var(--pie-white, white);
		border-radius: 1px;
		opacity: 0.8;
	}

	.pie-section-player-split-divider:hover .pie-section-player-split-divider-handle,
	.pie-section-player-split-divider:focus .pie-section-player-split-divider-handle,
	.pie-section-player-split-divider--dragging .pie-section-player-split-divider-handle {
		background: var(--pie-primary, #1976d2);
		height: 80px;
		box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
	}

	.pie-section-player-split-divider--dragging {
		background: var(--pie-primary-light, #dbeafe);
	}
</style>
