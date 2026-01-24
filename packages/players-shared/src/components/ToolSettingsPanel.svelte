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

	function onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	$effect(() => {
		if (open) queueMicrotask(() => panelEl?.focus?.());
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
	<div class="fixed inset-0 z-[4000]" aria-hidden="true"></div>
	<div
		bind:this={panelEl}
		class="tool-settings-panel fixed z-[4100] right-4 top-16 w-80 rounded-box bg-base-100 shadow p-3 text-base-content"
		role="dialog"
		aria-label={title}
		tabindex="-1"
		onkeydown={onKeyDown}
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
