<script lang="ts">
	import { onMount } from 'svelte';

	let {
		open,
		title = 'Settings',
		onClose,
		anchorEl = null
	}: {
		open: boolean;
		title?: string;
		onClose: () => void;
		anchorEl?: HTMLElement | null;
	} = $props();

	let panelEl = $state<HTMLDivElement | null>(null);
	let panelPosition = $state<{ top: number; left?: number; right?: number } | null>(null);

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	$effect(() => {
		if (open) queueMicrotask(() => panelEl?.focus?.());
	});

	// Calculate position based on anchor element
	$effect(() => {
		if (open && anchorEl) {
			const anchorRect = anchorEl.getBoundingClientRect();
			const panelWidth = 320; // w-80 = 20rem = 320px
			const spacing = 8; // Gap from anchor

			// Try to position to the right of anchor first
			const rightPosition = anchorRect.right + spacing;
			const hasSpaceOnRight = rightPosition + panelWidth <= window.innerWidth;

			if (hasSpaceOnRight) {
				// Position to the right of anchor
				panelPosition = {
					top: anchorRect.top,
					left: rightPosition
				};
			} else {
				// Position to the left of anchor
				panelPosition = {
					top: anchorRect.top,
					right: window.innerWidth - anchorRect.left + spacing
				};
			}
		} else {
			panelPosition = null;
		}
	});

	onMount(() => {
		const onDocClick = (e: MouseEvent) => {
			if (!open) return;
			const target = e.target as Node | null;
			if (!target) return;
			if (panelEl?.contains(target)) return;
			if (anchorEl?.contains(target)) return;
			onClose();
		};

		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	});
</script>

{#if open}
	<div class="fixed inset-0" aria-hidden="true" onmousedown={onClose} style="z-index: 4000;"></div>
	<div
		bind:this={panelEl}
		class="tool-settings-panel fixed w-80 rounded-box bg-base-100 shadow p-3 text-base-content"
		role="dialog"
		aria-label={title}
		tabindex="-1"
		onkeydown={onKeyDown}
		style="z-index: 4100; {panelPosition ? `top: ${panelPosition.top}px; ${panelPosition.left !== undefined ? `left: ${panelPosition.left}px;` : `right: ${panelPosition.right}px;`}` : 'top: 4rem; right: 1rem;'}"
	>
		<div class="flex items-center justify-between gap-2 mb-2">
			<h2 class="font-semibold text-sm">{title}</h2>
			<button type="button" class="btn btn-ghost btn-xs" onclick={onClose} aria-label="Close settings">Close</button>
		</div>
		<div class="text-sm">
			<slot />
		</div>
	</div>
{/if}
