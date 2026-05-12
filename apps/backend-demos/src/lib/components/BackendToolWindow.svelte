<script lang="ts">
	import { onMount, untrack } from "svelte";
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		ariaLabel?: string;
		offset?: number;
		widthClass?: string;
		onClose: () => void;
		children?: Snippet;
		icon?: Snippet;
	}

	let {
		title,
		ariaLabel = title,
		offset = 0,
		widthClass = "w-[min(42rem,calc(100vw-2rem))]",
		onClose,
		children,
		icon,
	}: Props = $props();

	const top = $derived(5 + offset * 1.25);
	const right = $derived(1 + offset * 1.25);
	const titleId = $derived(
		`backend-tool-window-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${offset}`,
	);
	let closeButton: HTMLButtonElement | null = $state(null);
	let returnFocusTarget: HTMLElement | null = null;

	function closeWindow(): void {
		onClose();
		queueMicrotask(() => returnFocusTarget?.focus({ preventScroll: true }));
	}

	onMount(() => {
		returnFocusTarget =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		untrack(() => closeButton?.focus({ preventScroll: true }));

		function handleKeydown(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			closeWindow();
		}

		window.addEventListener("keydown", handleKeydown);
		return () => window.removeEventListener("keydown", handleKeydown);
	});
</script>

<div
	class={`backend-tool-window fixed overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-2xl ${widthClass}`}
	style={`--backend-tool-window-top: ${top}rem; --backend-tool-window-right: ${right}rem; z-index: ${60 + offset};`}
	role="dialog"
	aria-label={ariaLabel}
	aria-labelledby={titleId}
>
	<header class="flex items-center justify-between gap-3 border-b border-base-300 bg-base-200/70 px-4 py-3">
		<div class="flex min-w-0 items-center gap-2">
			<span class="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/10 text-primary">
				{@render icon?.()}
			</span>
			<h2 id={titleId} class="truncate text-sm font-semibold">{title}</h2>
		</div>
		<button
			bind:this={closeButton}
			type="button"
			class="btn btn-ghost btn-xs btn-square"
			onclick={closeWindow}
			aria-label={`Close ${title}`}
			title={`Close ${title}`}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</header>
	<div class="max-h-[calc(100vh-6.5rem)] overflow-auto">
		{@render children?.()}
	</div>
</div>

<style>
	.backend-tool-window {
		top: min(var(--backend-tool-window-top), 8rem);
		right: 1rem;
		max-height: calc(100vh - min(var(--backend-tool-window-top), 8rem) - 1rem);
	}

	@media (max-width: 639px) {
		.backend-tool-window {
			left: 1rem;
			right: 1rem;
			width: auto !important;
		}
	}

	@media (min-width: 640px) {
		.backend-tool-window {
			right: min(var(--backend-tool-window-right), 3rem);
		}
	}
</style>
