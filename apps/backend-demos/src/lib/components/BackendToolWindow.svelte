<script lang="ts">
	import { onDestroy, onMount } from "svelte";
	import type { Snippet } from "svelte";

	interface Props {
		title: string;
		ariaLabel?: string;
		offset?: number;
		widthClass?: string;
		persistenceScope?: string;
		persistencePanelId?: string;
		onClose: () => void;
		children?: Snippet;
		icon?: Snippet;
	}

	type PanelState = {
		x: number;
		y: number;
		width: number;
		height: number;
	};

	const STORAGE_KEY_PREFIX = "pie:debug-panels:v1";
	const FLOATING_PANEL_Z_INDEX_KEY = "__pieBackendFloatingPanelZIndex";
	const minWidth = 380;
	const minHeight = 320;

	let {
		title,
		ariaLabel = title,
		offset = 0,
		widthClass = "",
		persistenceScope = "backend-demos",
		persistencePanelId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
		onClose,
		children,
		icon,
	}: Props = $props();

	let returnFocusTarget: HTMLElement | null = null;
	let panelX = $state(16);
	let panelY = $state(96);
	let panelWidth = $state(520);
	let panelHeight = $state(560);
	let panelZIndex = $state(claimNextFloatingPanelZIndex());
	let isMinimized = $state(false);
	let hasMounted = $state(false);
	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartPanelX = 0;
	let dragStartPanelY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	const resolvedClassName = $derived(["backend-tool-window", widthClass].filter(Boolean).join(" "));
	const panelStyle = $derived(
		`left: ${panelX}px; top: ${panelY}px; width: ${panelWidth}px; z-index: ${panelZIndex}; ${
			isMinimized ? "height: auto;" : `height: ${panelHeight}px;`
		}`,
	);

	function claimNextFloatingPanelZIndex(): number {
		const runtime = globalThis as typeof globalThis & {
			[FLOATING_PANEL_Z_INDEX_KEY]?: number;
		};
		const current =
			typeof runtime[FLOATING_PANEL_Z_INDEX_KEY] === "number"
				? runtime[FLOATING_PANEL_Z_INDEX_KEY]
				: 9999;
		const next = current + 1;
		runtime[FLOATING_PANEL_Z_INDEX_KEY] = next;
		return next;
	}

	function bringToFront(): void {
		panelZIndex = claimNextFloatingPanelZIndex();
	}

	function getPersistenceKey(): string | null {
		const scope = String(persistenceScope || "").trim();
		const panelId = String(persistencePanelId || "").trim();
		if (!scope || !panelId) return null;
		return `${STORAGE_KEY_PREFIX}:${scope}:${panelId}:layout`;
	}

	function clampPanelState(state: PanelState): PanelState {
		const width = Math.max(minWidth, Math.min(window.innerWidth, state.width));
		const height = Math.max(minHeight, Math.min(window.innerHeight, state.height));
		const maxX = Math.max(0, window.innerWidth - width);
		const maxY = Math.max(0, window.innerHeight - 100);
		return {
			x: Math.max(0, Math.min(maxX, state.x)),
			y: Math.max(0, Math.min(maxY, state.y)),
			width,
			height,
		};
	}

	function computeInitialPanelState(): PanelState {
		const width = Math.max(minWidth, Math.min(760, Math.round(window.innerWidth * 0.42)));
		const height = Math.max(minHeight, Math.min(860, Math.round(window.innerHeight * 0.72)));
		const paddingX = 16 + offset * 24;
		const paddingY = 96 + offset * 24;
		return clampPanelState({
			x: Math.max(paddingX, window.innerWidth - width - paddingX),
			y: paddingY,
			width,
			height,
		});
	}

	function restorePersistedLayout(): boolean {
		const key = getPersistenceKey();
		if (!key) return false;
		try {
			const raw = localStorage.getItem(key);
			if (!raw) return false;
			const parsed = JSON.parse(raw) as Partial<PanelState> & { minimized?: boolean };
			if (
				typeof parsed.x !== "number" ||
				typeof parsed.y !== "number" ||
				typeof parsed.width !== "number" ||
				typeof parsed.height !== "number"
			) {
				return false;
			}
			const clamped = clampPanelState({
				x: parsed.x,
				y: parsed.y,
				width: parsed.width,
				height: parsed.height,
			});
			panelX = clamped.x;
			panelY = clamped.y;
			panelWidth = clamped.width;
			panelHeight = clamped.height;
			isMinimized = parsed.minimized === true;
			return true;
		} catch {
			return false;
		}
	}

	function closeWindow(): void {
		onClose();
		queueMicrotask(() => returnFocusTarget?.focus({ preventScroll: true }));
	}

	function stopDrag(): void {
		isDragging = false;
		document.removeEventListener("mousemove", handleDragMove);
		document.removeEventListener("mouseup", stopDrag);
	}

	function stopResize(): void {
		isResizing = false;
		document.removeEventListener("mousemove", handleResizeMove);
		document.removeEventListener("mouseup", stopResize);
	}

	function handleDragMove(event: MouseEvent): void {
		if (!isDragging) return;
		const maxX = Math.max(0, window.innerWidth - panelWidth);
		const maxY = Math.max(0, window.innerHeight - 100);
		panelX = Math.max(0, Math.min(dragStartPanelX + event.clientX - dragStartX, maxX));
		panelY = Math.max(0, Math.min(dragStartPanelY + event.clientY - dragStartY, maxY));
	}

	function handleResizeMove(event: MouseEvent): void {
		if (!isResizing) return;
		const maxWidth = Math.max(minWidth, window.innerWidth - panelX);
		const maxHeight = Math.max(minHeight, window.innerHeight - panelY);
		panelWidth = Math.max(minWidth, Math.min(resizeStartWidth + event.clientX - resizeStartX, maxWidth));
		panelHeight = Math.max(minHeight, Math.min(resizeStartHeight + event.clientY - resizeStartY, maxHeight));
	}

	function startDrag(event: MouseEvent): void {
		bringToFront();
		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragStartPanelX = panelX;
		dragStartPanelY = panelY;
		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", stopDrag);
	}

	function startResize(event: MouseEvent): void {
		bringToFront();
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = panelWidth;
		resizeStartHeight = panelHeight;
		document.addEventListener("mousemove", handleResizeMove);
		document.addEventListener("mouseup", stopResize);
		event.preventDefault();
		event.stopPropagation();
	}

	onMount(() => {
		returnFocusTarget =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (!restorePersistedLayout()) {
			const initial = computeInitialPanelState();
			panelX = initial.x;
			panelY = initial.y;
			panelWidth = initial.width;
			panelHeight = initial.height;
		}
		hasMounted = true;

		function handleKeydown(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;
			event.stopPropagation();
			closeWindow();
		}

		window.addEventListener("keydown", handleKeydown);
		return () => window.removeEventListener("keydown", handleKeydown);
	});

	onDestroy(() => {
		stopDrag();
		stopResize();
	});

	$effect(() => {
		if (!hasMounted) return;
		const key = getPersistenceKey();
		if (!key) return;
		try {
			localStorage.setItem(
				key,
				JSON.stringify({
					x: panelX,
					y: panelY,
					width: panelWidth,
					height: panelHeight,
					minimized: isMinimized,
				}),
			);
		} catch {
			// Ignore storage write failures.
		}
	});
</script>

<div
	class={resolvedClassName}
	style={panelStyle}
	role="dialog"
	aria-label={ariaLabel}
>
	<header
		class="backend-tool-window__header"
		onmousedown={startDrag}
		role="button"
		tabindex="0"
		aria-label={`Drag ${ariaLabel} panel`}
	>
		<div class="backend-tool-window__header-main">
			<span class="backend-tool-window__icon">
				{@render icon?.()}
			</span>
			<h2 class="backend-tool-window__title">{title}</h2>
		</div>
		<div class="backend-tool-window__controls">
			<button
				type="button"
				class="backend-tool-window__control"
				onmousedown={(event) => event.stopPropagation()}
				onclick={() => (isMinimized = !isMinimized)}
				aria-label={isMinimized ? "Maximize panel" : "Minimize panel"}
				title={isMinimized ? "Maximize" : "Minimize"}
			>
				{#if isMinimized}
					<svg xmlns="http://www.w3.org/2000/svg" class="backend-tool-window__control-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="backend-tool-window__control-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button
				type="button"
				class="backend-tool-window__control"
				onmousedown={(event) => event.stopPropagation()}
				onclick={closeWindow}
				aria-label="Close panel"
				title="Close"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="backend-tool-window__control-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</header>

	{#if !isMinimized}
		<div class="backend-tool-window__body">
			{@render children?.()}
		</div>
		<div
			class="backend-tool-window__resize-handle"
			onmousedown={startResize}
			role="button"
			tabindex="0"
			title="Resize window"
			aria-label={`Resize ${ariaLabel} panel`}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="backend-tool-window__resize-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16h8m-5-4h5m-2-4h2" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.backend-tool-window {
		position: fixed;
		display: flex;
		flex-direction: column;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.backend-tool-window__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 1rem;
		background: var(--color-base-200, #f3f4f6);
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
		cursor: move;
		user-select: none;
	}

	.backend-tool-window__header:focus-visible {
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: -2px;
	}

	.backend-tool-window__header-main {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		gap: 0.5rem;
	}

	.backend-tool-window__title {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.backend-tool-window__icon {
		display: inline-flex;
		width: 1rem;
		height: 1rem;
		flex: none;
		align-items: center;
		justify-content: center;
		color: var(--color-primary, #ef4444);
	}

	.backend-tool-window__controls {
		display: flex;
		gap: 0.25rem;
	}

	.backend-tool-window__control {
		display: inline-flex;
		width: 1.35rem;
		height: 1.35rem;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.7);
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.65);
		color: #334155;
		cursor: pointer;
	}

	.backend-tool-window__control:hover {
		background: rgba(241, 245, 249, 0.95);
	}

	.backend-tool-window__control:focus-visible {
		outline: 2px solid var(--color-primary, #3b82f6);
		outline-offset: 1px;
	}

	.backend-tool-window__control-icon,
	.backend-tool-window__resize-icon {
		width: 0.75rem;
		height: 0.75rem;
	}

	.backend-tool-window__body {
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.backend-tool-window__resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		display: inline-flex;
		width: 0.85rem;
		height: 0.85rem;
		align-items: center;
		justify-content: center;
		color: color-mix(in srgb, var(--color-base-content, #334155) 30%, transparent);
		cursor: nwse-resize;
		opacity: 0.82;
	}

	.backend-tool-window__resize-handle:hover,
	.backend-tool-window__resize-handle:focus-visible {
		opacity: 1;
		outline: none;
	}

	@media (max-width: 639px) {
		.backend-tool-window {
			left: 1rem !important;
			right: 1rem;
			width: auto !important;
		}
	}
</style>
