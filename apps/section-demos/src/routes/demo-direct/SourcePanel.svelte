<script lang="ts">
	import { onDestroy, onMount } from 'svelte';

	interface Props {
		editedSourceJson: string;
		onClose?: () => void;
	}

	let { editedSourceJson, onClose = () => {} }: Props = $props();

	let sourceWindowX = $state(50);
	let sourceWindowY = $state(50);
	let sourceWindowWidth = $state(800);
	let sourceWindowHeight = $state(700);
	let isSourceMinimized = $state(false);
	let isSourceDragging = $state(false);
	let isSourceResizing = $state(false);

	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartWindowX = 0;
	let dragStartWindowY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	onMount(() => {
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		sourceWindowWidth = clamp(Math.round(viewportWidth * 0.72), 640, 1200);
		sourceWindowHeight = clamp(Math.round(viewportHeight * 0.78), 420, 940);
		sourceWindowX = Math.max(16, Math.round((viewportWidth - sourceWindowWidth) / 2));
		sourceWindowY = Math.max(16, Math.round((viewportHeight - sourceWindowHeight) / 2));
	});

	onDestroy(() => {
		document.removeEventListener('mousemove', onSourceDrag);
		document.removeEventListener('mouseup', stopSourceDrag);
		document.removeEventListener('mousemove', onSourceResize);
		document.removeEventListener('mouseup', stopSourceResize);
	});

	function startSourceDrag(e: MouseEvent) {
		isSourceDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartWindowX = sourceWindowX;
		dragStartWindowY = sourceWindowY;

		document.addEventListener('mousemove', onSourceDrag);
		document.addEventListener('mouseup', stopSourceDrag);
	}

	function onSourceDrag(e: MouseEvent) {
		if (!isSourceDragging) return;

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		sourceWindowX = dragStartWindowX + deltaX;
		sourceWindowY = dragStartWindowY + deltaY;

		sourceWindowX = Math.max(0, Math.min(sourceWindowX, window.innerWidth - sourceWindowWidth));
		sourceWindowY = Math.max(0, Math.min(sourceWindowY, window.innerHeight - 100));
	}

	function stopSourceDrag() {
		isSourceDragging = false;
		document.removeEventListener('mousemove', onSourceDrag);
		document.removeEventListener('mouseup', stopSourceDrag);
	}

	function startSourceResize(e: MouseEvent) {
		isSourceResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartWidth = sourceWindowWidth;
		resizeStartHeight = sourceWindowHeight;

		document.addEventListener('mousemove', onSourceResize);
		document.addEventListener('mouseup', stopSourceResize);
		e.stopPropagation();
	}

	function onSourceResize(e: MouseEvent) {
		if (!isSourceResizing) return;

		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;

		sourceWindowWidth = Math.max(400, Math.min(resizeStartWidth + deltaX, window.innerWidth - sourceWindowX));
		sourceWindowHeight = Math.max(300, Math.min(resizeStartHeight + deltaY, window.innerHeight - sourceWindowY));
	}

	function stopSourceResize() {
		isSourceResizing = false;
		document.removeEventListener('mousemove', onSourceResize);
		document.removeEventListener('mouseup', stopSourceResize);
	}

	function copyJson() {
		if (typeof navigator !== 'undefined') {
			void navigator.clipboard.writeText(editedSourceJson);
		}
	}
</script>

<div
	class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
	style="left: {sourceWindowX}px; top: {sourceWindowY}px; width: {sourceWindowWidth}px; {isSourceMinimized ? 'height: auto;' : `height: ${sourceWindowHeight}px;`}"
>
	<div
		class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
		onmousedown={startSourceDrag}
		role="button"
		tabindex="0"
		aria-label="Drag source panel"
	>
		<div class="flex items-center gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
			</svg>
			<h3 class="font-bold text-sm">Source</h3>
		</div>
		<div class="flex gap-1">
			<button
				class="btn btn-xs btn-ghost btn-circle"
				onclick={() => isSourceMinimized = !isSourceMinimized}
				title={isSourceMinimized ? 'Maximize' : 'Minimize'}
			>
				{#if isSourceMinimized}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button
				class="btn btn-xs btn-ghost btn-circle"
				onclick={onClose}
				title="Close"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	{#if !isSourceMinimized}
		<div class="flex flex-col overflow-hidden" style="height: {sourceWindowHeight - 50}px;">
			<div class="flex items-center justify-between px-4 py-2 bg-base-200/50 border-b border-base-300">
				<div class="text-xs text-base-content/70">
					Read-only formatted JSON
				</div>
				<div class="flex gap-2">
					<button
						class="btn btn-xs btn-ghost"
						onclick={copyJson}
						title="Copy to clipboard"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						Copy
					</button>
				</div>
			</div>

			<div class="flex-1 min-h-0 overflow-auto">
				<pre class="h-full w-full m-0 p-4 bg-base-300 text-xs font-mono overflow-auto whitespace-pre-wrap">{editedSourceJson}</pre>
			</div>
		</div>
	{/if}

	{#if !isSourceMinimized}
		<div
			class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
			onmousedown={startSourceResize}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			<svg
				class="w-full h-full text-base-content/30"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M16 16V14H14V16H16Z" />
				<path d="M16 11V9H14V11H16Z" />
				<path d="M13 16V14H11V16H13Z" />
			</svg>
		</div>
	{/if}
</div>
