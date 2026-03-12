<script lang="ts">
	import PanelResizeHandle from '@pie-players/pie-section-player-tools-shared/PanelResizeHandle.svelte';
	import PanelWindowControls from '@pie-players/pie-section-player-tools-shared/PanelWindowControls.svelte';
	import {
		claimNextFloatingPanelZIndex,
		computePanelSizeFromViewport,
		createFloatingPanelPointerController
	} from '@pie-players/pie-section-player-tools-shared';
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
	let sourcePanelZIndex = $state(claimNextFloatingPanelZIndex());
	let isSourceMinimized = $state(false);

	function bringSourcePanelToFront(): void {
		sourcePanelZIndex = claimNextFloatingPanelZIndex();
	}

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			{
				widthRatio: 0.72,
				heightRatio: 0.78,
				minWidth: 640,
				maxWidth: 1200,
				minHeight: 420,
				maxHeight: 940,
				alignX: 'center',
				alignY: 'center',
				paddingX: 16,
				paddingY: 16
			}
		);
		sourceWindowX = initial.x;
		sourceWindowY = initial.y;
		sourceWindowWidth = initial.width;
		sourceWindowHeight = initial.height;
	});

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: sourceWindowX,
			y: sourceWindowY,
			width: sourceWindowWidth,
			height: sourceWindowHeight
		}),
		setState: (next: { x: number; y: number; width: number; height: number }) => {
			sourceWindowX = next.x;
			sourceWindowY = next.y;
			sourceWindowWidth = next.width;
			sourceWindowHeight = next.height;
		},
		minWidth: 400,
		minHeight: 300,
		onFocus: bringSourcePanelToFront
	});

	onDestroy(() => {
		pointerController.stop();
	});

	function copyJson(): void {
		if (typeof navigator !== 'undefined') {
			void navigator.clipboard.writeText(editedSourceJson);
		}
	}
</script>

<div
	class="pie-section-player-tools-source-panel"
	style="left: {sourceWindowX}px; top: {sourceWindowY}px; width: {sourceWindowWidth}px; z-index: {sourcePanelZIndex}; {isSourceMinimized ? 'height: auto;' : `height: ${sourceWindowHeight}px;`}"
>
	<div
		class="pie-section-player-tools-source-panel__header"
		onmousedown={(event: MouseEvent) => pointerController.startDrag(event)}
		role="button"
		tabindex="0"
		aria-label="Drag source panel"
	>
		<div class="pie-section-player-tools-source-panel__header-title">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-source-panel__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
			</svg>
			<h3 class="pie-section-player-tools-source-panel__title">Source</h3>
		</div>
		<div class="pie-section-player-tools-source-panel__header-actions">
			<PanelWindowControls
				minimized={isSourceMinimized}
				onToggle={() => (isSourceMinimized = !isSourceMinimized)}
				onClose={onClose}
			/>
		</div>
	</div>

	{#if !isSourceMinimized}
		<div class="pie-section-player-tools-source-panel__content-shell" style="height: {sourceWindowHeight - 50}px;">
			<div class="pie-section-player-tools-source-panel__content-toolbar">
				<div class="pie-section-player-tools-source-panel__content-caption">Read-only formatted JSON</div>
				<button
					type="button"
					class="pie-section-player-tools-source-panel__copy-button"
					onclick={copyJson}
					title="Copy to clipboard"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="pie-section-player-tools-source-panel__copy-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
					</svg>
					Copy
				</button>
			</div>

			<div class="pie-section-player-tools-source-panel__content-scroll">
				<pre class="pie-section-player-tools-source-panel__pre">{editedSourceJson}</pre>
			</div>
		</div>
	{/if}

	{#if !isSourceMinimized}
		<PanelResizeHandle onPointerDown={(event: MouseEvent) => pointerController.startResize(event)} />
	{/if}
</div>

<style>
	.pie-section-player-tools-source-panel {
		position: fixed;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-section-player-tools-source-panel__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-source-panel__header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-section-player-tools-source-panel__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-source-panel__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-section-player-tools-source-panel__header-actions {
		display: flex;
		gap: 4px;
	}

	.pie-section-player-tools-source-panel__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pie-section-player-tools-source-panel__content-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
		background: color-mix(in srgb, var(--color-base-200, #f3f4f6) 60%, transparent);
	}

	.pie-section-player-tools-source-panel__content-caption {
		font-size: 0.75rem;
		opacity: 0.75;
	}

	.pie-section-player-tools-source-panel__copy-button {
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-100, #fff);
		color: inherit;
		border-radius: 6px;
		font-size: 0.75rem;
		padding: 4px 8px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}

	.pie-section-player-tools-source-panel__copy-icon {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-tools-source-panel__content-scroll {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.pie-section-player-tools-source-panel__pre {
		margin: 0;
		padding: 12px;
		font-size: 0.74rem;
		line-height: 1.35;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		background: color-mix(in srgb, var(--color-base-200, #f3f4f6) 45%, transparent);
	}
</style>
