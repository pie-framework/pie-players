<svelte:options
	customElement={{
		tag: 'pie-tool-line-reader',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<script lang="ts">
	
	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import ToolSettingsButton from '@pie-players/pie-players-shared/components/ToolSettingsButton.svelte';
	import ToolSettingsPanel from '@pie-players/pie-players-shared/components/ToolSettingsPanel.svelte';
import { onMount } from 'svelte';

	// Props
	let { visible = false, toolId = 'lineReader' }: { visible?: boolean; toolId?: string } = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);
	let settingsButtonEl = $state<HTMLButtonElement | undefined>();
	let isDragging = $state(false);
	let isResizing = $state(false);
	let position = $state({
		x: isBrowser ? window.innerWidth / 2 : 400,
		y: isBrowser ? window.innerHeight / 2 : 300
	});
	let size = $state({ width: 600, height: 60 });
	let dragStart = $state({ x: 0, y: 0 });
	let resizeStart = $state({ width: 0, height: 0, mouseY: 0 });
	let announceText = $state('');
	let currentColor = $state('#ffff00'); // Yellow
	let currentOpacity = $state(0.3);
	let maskingMode = $state<'highlight' | 'obscure'>('highlight');
	let settingsOpen = $state(false);

	// Track registration state
	let registered = $state(false);

	// Available colors
	const colors = [
		{ name: 'Yellow', value: '#ffff00' },
		{ name: 'Blue', value: '#00bfff' },
		{ name: 'Pink', value: '#ff69b4' },
		{ name: 'Green', value: '#00ff7f' },
		{ name: 'Orange', value: '#ffa500' }
	];

	// Keyboard navigation constants
	const MOVE_STEP = 10; // pixels
	const RESIZE_STEP = 10; // pixels

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	function announce(message: string) {
		announceText = message;
		setTimeout(() => announceText = '', 1000);
	}

	function cycleColor() {
		const currentIndex = colors.findIndex(c => c.value === currentColor);
		const nextIndex = (currentIndex + 1) % colors.length;
		currentColor = colors[nextIndex].value;
		announce(`Color changed to ${colors[nextIndex].name}`);
	}

	function adjustOpacity(delta: number) {
		currentOpacity = Math.max(0.1, Math.min(0.9, currentOpacity + delta));
		announce(`Opacity ${Math.round(currentOpacity * 100)}%`);
	}

	function toggleMaskingMode() {
		maskingMode = maskingMode === 'highlight' ? 'obscure' : 'highlight';
		announce(`Mode changed to ${maskingMode === 'highlight' ? 'highlight' : 'masking'}`);
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	function setColor(color: string) {
		currentColor = color;
		const colorName = colors.find(c => c.value === color)?.name || 'Unknown';
		announce(`Color changed to ${colorName}`);
	}

	// Pointer event handlers (better for web components)
	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		// Check if clicking the resize handle
		if (target.closest('.resize-handle')) {
			startResizing(e);
		} else if (target.closest('.tool-settings-button') || target.closest('.tool-settings-panel')) {
			// Don't start dragging when clicking settings
			return;
		} else {
			startDragging(e);
		}
	}

	function startDragging(e: PointerEvent) {
		if (!containerEl) return;

		// Capture pointer for isolated event handling
		containerEl.setPointerCapture(e.pointerId);
		isDragging = true;
		dragStart = {
			x: e.clientX - position.x,
			y: e.clientY - position.y
		};

		coordinator?.bringToFront(containerEl);

		// Add pointer move/up handlers to element (not window!)
		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
	}

	function startResizing(e: PointerEvent) {
		if (!containerEl) return;

		// Capture pointer for isolated event handling
		containerEl.setPointerCapture(e.pointerId);

		isResizing = true;
		resizeStart = {
			width: size.width,
			height: size.height,
			mouseY: e.clientY
		};

		coordinator?.bringToFront(containerEl);

		// Add pointer move/up handlers to element (not window!)
		containerEl.addEventListener('pointermove', handlePointerMove);
		containerEl.addEventListener('pointerup', handlePointerUp);

		e.preventDefault();
		e.stopPropagation();
	}

	function handlePointerMove(e: PointerEvent) {
		if (isDragging) {
			position = {
				x: e.clientX - dragStart.x,
				y: e.clientY - dragStart.y
			};
		} else if (isResizing) {
			// Vertical resize only
			const deltaY = e.clientY - resizeStart.mouseY;
			size.height = Math.max(20, Math.min(400, resizeStart.height + deltaY));
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (!containerEl) return;

		// Release pointer capture
		containerEl.releasePointerCapture(e.pointerId);

		// Clean up event listeners
		containerEl.removeEventListener('pointermove', handlePointerMove);
		containerEl.removeEventListener('pointerup', handlePointerUp);

		isDragging = false;
		isResizing = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		let handled = false;

		switch (e.key) {
			case 'ArrowUp':
				position.y -= MOVE_STEP;
				announce(`Moved up to ${Math.round(position.y)}`);
				handled = true;
				break;
			case 'ArrowDown':
				position.y += MOVE_STEP;
				announce(`Moved down to ${Math.round(position.y)}`);
				handled = true;
				break;
			case 'ArrowLeft':
				position.x -= MOVE_STEP;
				announce(`Moved left to ${Math.round(position.x)}`);
				handled = true;
				break;
			case 'ArrowRight':
				position.x += MOVE_STEP;
				announce(`Moved right to ${Math.round(position.x)}`);
				handled = true;
				break;
			case '+':
			case '=':
				size.height = Math.min(400, size.height + RESIZE_STEP);
				announce(`Height ${size.height} pixels`);
				handled = true;
				break;
			case '-':
			case '_':
				size.height = Math.max(20, size.height - RESIZE_STEP);
				announce(`Height ${size.height} pixels`);
				handled = true;
				break;
			case 'c':
			case 'C':
				cycleColor();
				handled = true;
				break;
			case ']':
				adjustOpacity(0.1);
				handled = true;
				break;
			case '[':
				adjustOpacity(-0.1);
				handled = true;
				break;
			case 'm':
			case 'M':
				toggleMaskingMode();
				handled = true;
				break;
		}

		if (handled) {
			e.preventDefault();
		}
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Line Reader', undefined, ZIndexLayer.TOOL);
			registered = true;
		}
	});

	onMount(() => {
		return () => {
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// Auto-focus when tool becomes visible
	$effect(() => {
		if (visible && containerEl) {
			setTimeout(() => containerEl?.focus(), 100);
		}
	});

	// Computed background color with opacity
	let backgroundColor = $derived(currentColor + Math.round(currentOpacity * 255).toString(16).padStart(2, '0'));
</script>

{#if visible}
	<!-- Screen reader announcements -->
	<div class="pie-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announceText}
	</div>

	<!-- Masking overlays (only in obscure mode) - 4 rectangles around the line reader window -->
	{#if maskingMode === 'obscure'}
		<!-- Top mask - from top of viewport to top of line reader -->
		<div
			class="pie-tool-line-reader__mask pie-tool-line-reader__mask--top"
			style="height: {Math.max(0, position.y - size.height / 2)}px;"
			aria-hidden="true"
		></div>
		<!-- Bottom mask - from bottom of line reader to bottom of viewport -->
		<div
			class="pie-tool-line-reader__mask pie-tool-line-reader__mask--bottom"
			style="top: {position.y + size.height / 2}px;"
			aria-hidden="true"
		></div>
		<!-- Left mask - left side of line reader window -->
		<div
			class="pie-tool-line-reader__mask pie-tool-line-reader__mask--left"
			style="top: {position.y - size.height / 2}px; height: {size.height}px; width: {Math.max(0, position.x - size.width / 2)}px;"
			aria-hidden="true"
		></div>
		<!-- Right mask - right side of line reader window -->
		<div
			class="pie-tool-line-reader__mask pie-tool-line-reader__mask--right"
			style="top: {position.y - size.height / 2}px; height: {size.height}px; left: {position.x + size.width / 2}px;"
			aria-hidden="true"
		></div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={containerEl}
		class="pie-tool-line-reader"
		class:pie-tool-line-reader--masking-mode={maskingMode === 'obscure'}
		style="left: {position.x}px; top: {position.y}px; width: {size.width}px; height: {size.height}px;"
		onpointerdown={handlePointerDown}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
		aria-label="Line Reader tool. Mode: {maskingMode === 'highlight' ? 'Highlight' : 'Masking'}. Use arrow keys to move, +/- to resize height, C to change color, [ and ] to adjust opacity, M to toggle mode. Current color: {colors.find(c => c.value === currentColor)?.name}, Opacity: {Math.round(currentOpacity * 100)}%"
		aria-roledescription="Draggable and resizable reading guide overlay"
	>
		<div class="pie-tool-line-reader__container" style="background-color: {backgroundColor};">
			<!-- Settings Button -->
			<ToolSettingsButton
				bind:buttonEl={settingsButtonEl}
				onClick={toggleSettings}
				ariaLabel="Line reader settings"
				active={settingsOpen}
			/>
		</div>

		<!-- Resize handle -->
		<div
			class="pie-tool-line-reader__resize-handle pie-tool-line-reader__resize-handle--bottom"
			title="Drag to resize height"
			role="button"
			tabindex="-1"
			aria-label="Resize handle - drag to adjust height"
		>
			<svg width="20" height="8" viewBox="0 0 20 8" aria-hidden="true">
				<rect x="8" y="3" width="4" height="2" fill="#4CAF50" rx="1"/>
			</svg>
		</div>
	</div>

	<!-- Settings Panel - Rendered outside pie-tool-line-reader to avoid height constraints -->
	<ToolSettingsPanel
		open={settingsOpen}
		title="Line Reader Settings"
		onClose={closeSettings}
		anchorEl={settingsButtonEl}
	>
		<!-- Mode Selection - First, as it determines what other settings are relevant -->
		<fieldset class="setting-group">
			<legend>Mode</legend>
			<label>
				<input
					type="radio"
					name="mode"
					value="highlight"
					checked={maskingMode === 'highlight'}
					onchange={() => { maskingMode = 'highlight'; announce('Mode changed to highlight'); }}
				/>
				<span>Highlight</span>
			</label>
			<label>
				<input
					type="radio"
					name="mode"
					value="obscure"
					checked={maskingMode === 'obscure'}
					onchange={() => { maskingMode = 'obscure'; announce('Mode changed to masking'); }}
				/>
				<span>Masking</span>
			</label>
		</fieldset>

		<!-- Color Selection - Only shown in Highlight mode -->
		{#if maskingMode === 'highlight'}
			<fieldset class="setting-group">
				<legend>Color</legend>
				{#each colors as color}
					<label>
						<input
							type="radio"
							name="color"
							value={color.value}
							checked={currentColor === color.value}
							onchange={() => setColor(color.value)}
						/>
						<div class="color-swatch" style="background-color: {color.value};"></div>
						<span>{color.name}</span>
					</label>
				{/each}
			</fieldset>

			<!-- Opacity Slider - Only shown in Highlight mode -->
			<div class="setting-group">
				<div class="setting-label">
					<span>Opacity</span>
					<span class="setting-value" aria-live="polite">{Math.round(currentOpacity * 100)}%</span>
				</div>
				<input
					type="range"
					min="10"
					max="90"
					step="5"
					value={currentOpacity * 100}
					oninput={(e) => {
						currentOpacity = Number(e.currentTarget.value) / 100;
						announce(`Opacity ${Math.round(currentOpacity * 100)}%`);
					}}
					aria-label="Opacity"
					aria-valuemin="10"
					aria-valuemax="90"
					aria-valuenow={Math.round(currentOpacity * 100)}
					aria-valuetext="{Math.round(currentOpacity * 100)} percent"
				/>
			</div>
		{/if}
	</ToolSettingsPanel>
{/if}

<style>
	.pie-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.pie-tool-line-reader {
		border: 2px solid rgba(76, 175, 80, 0.8);
		cursor: move;
		overflow: visible;
		position: absolute;
		transform: translate(-50%, -50%);
		user-select: none;
		pointer-events: auto;
		touch-action: none;
	}

	.pie-tool-line-reader:focus {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.pie-tool-line-reader:focus-visible {
		outline: 3px solid #4A90E2;
		outline-offset: 2px;
	}

	.pie-tool-line-reader__container {
		width: 100%;
		height: 100%;
		position: relative;
		transition: background-color 0.2s ease;
	}


	.pie-tool-line-reader__resize-handle {
		position: absolute;
		cursor: ns-resize;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pie-tool-line-reader__resize-handle--bottom {
		bottom: -10px;
		left: 50%;
		transform: translateX(-50%);
		width: 40px;
		height: 16px;
		background-color: rgba(255, 255, 255, 0.9);
		border-radius: 8px;
		border: 2px solid #4CAF50;
	}

	.pie-tool-line-reader__resize-handle:hover {
		background-color: rgba(76, 175, 80, 0.2);
	}

	.pie-tool-line-reader__resize-handle:active {
		cursor: ns-resize;
	}

	.pie-tool-line-reader:active {
		cursor: grabbing;
	}

	/* Masking overlays for obscure mode - 4 rectangles covering all areas except line reader window */
	.pie-tool-line-reader__mask {
		position: fixed;
		background: rgba(0, 0, 0, 0.85);
		z-index: 999;
		pointer-events: none;
	}

	.pie-tool-line-reader__mask--top {
		top: 0;
		left: 0;
		right: 0;
		/* Height set via inline style */
	}

	.pie-tool-line-reader__mask--bottom {
		/* Top set via inline style */
		left: 0;
		right: 0;
		bottom: 0;
	}

	.pie-tool-line-reader__mask--left {
		/* Top, height, and width set via inline style */
		left: 0;
	}

	.pie-tool-line-reader__mask--right {
		/* Top, height, and left set via inline style */
		right: 0;
	}

	/* In masking mode, change the window appearance */
	.pie-tool-line-reader.pie-tool-line-reader--masking-mode {
		border-color: rgba(76, 175, 80, 1);
		box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.8), 0 0 20px rgba(76, 175, 80, 0.4);
	}

	/* In masking mode, the window should be transparent to show content underneath */
	.pie-tool-line-reader.pie-tool-line-reader--masking-mode .pie-tool-line-reader__container {
		background-color: transparent !important;
	}

</style>
