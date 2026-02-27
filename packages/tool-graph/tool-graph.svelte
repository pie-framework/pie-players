<svelte:options
	customElement={{
		tag: 'pie-tool-graph',
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
import { onDestroy, onMount } from 'svelte';

	// Props
	let {
		visible = false,
		toolId = 'graph'
	}: {
		visible?: boolean;
		toolId?: string;
	} = $props();

	// Check if running in browser
	const isBrowser = typeof window !== 'undefined';

	// Tool types (matching production implementation)
	type Tool = 'selector' | 'point' | 'line' | 'delete';

	// Data structures (matching production implementation)
	interface Point {
		id: number;
		x: number; // Coordinate in the dynamic viewBox space
		y: number; // Coordinate in the fixed 0-100 viewBox height
	}

	interface Line {
		id: number;
		p1Id: number;
		p2Id: number;
	}

	interface Coordinates {
		x: number;
		y: number;
	}

	// State
	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);
	let canvasWrapperEl = $state<HTMLDivElement | undefined>();
	let svgCanvasEl = $state<SVGSVGElement | undefined>();
	let settingsButtonEl = $state<HTMLButtonElement | undefined>();
	let settingsOpen = $state(false);

	// Position and size (matching production implementation defaults)
	let x = $state(isBrowser ? window.innerWidth / 2 : 400);
	let y = $state(isBrowser ? window.innerHeight / 2 : 300);
	let width = $state(700);
	let height = $state(550); // Production implementation uses 550px height

	// Tool state
	let currentTool = $state<Tool>('selector');
	let points = $state<Point[]>([]);
	let lines = $state<Line[]>([]);
	let nextId = $state(1);
	let gridOpacity = $state(1);
	let tempLineStartPointId = $state<number | null>(null);
	let draggingPointId = $state<number | null>(null);
	let currentPointerPos = $state<Coordinates | null>(null);

	// Track registration state
	let registered = $state(false);

	// Grid configuration (matching production implementation)
	const MAJOR_VERTICAL_DIVISIONS = 5; // Fixed number of rows
	const SUBGRID_DIVISIONS = 5; // 5x5 minor grid
	const DESIRED_MAJOR_CELL_SIZE_SVG = 100 / MAJOR_VERTICAL_DIVISIONS; // 100 / 5 = 20 units
	const DESIRED_MINOR_CELL_SIZE_SVG = DESIRED_MAJOR_CELL_SIZE_SVG / SUBGRID_DIVISIONS; // 20 / 5 = 4 units

	// Container pixel dimensions (from ResizeObserver)
	let containerPixelWidth = $state(0);
	let containerPixelHeight = $state(0);

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	// Dynamic viewBox width (matching production implementation)
	let viewBoxWidth = $derived.by(() => {
		if (containerPixelHeight <= 0 || containerPixelWidth <= 0) {
			return 100; // Default width until dimensions are known
		}
		// Calculate the vertical scaling factor: pixels per SVG unit
		const scaleY = containerPixelHeight / 100; // (viewBox height is 100)
		// Convert container pixel width back into SVG units using this scale
		const requiredWidthSVG = containerPixelWidth / scaleY;
		// Ensure a minimum width
		return Math.max(100, requiredWidthSVG);
	});

	// Tool definitions (matching production implementation)
	const tools: Array<{ name: Tool; icon: string; label: string; title: string }> = [
		{
			name: 'selector',
			icon: 'selector',
			label: 'Selector',
			title: 'Selector: Click and drag points to move them or associated lines.'
		},
		{
			name: 'point',
			icon: 'point',
			label: 'Point',
			title: 'Point: Click on the grid to add points.'
		},
		{
			name: 'line',
			icon: 'line',
			label: 'Line',
			title: 'Line: Click a starting point, then an ending point to draw a line.'
		},
		{
			name: 'delete',
			icon: 'delete',
			label: 'Delete',
			title: 'Delete: Click on a point to delete it and any connected lines.'
		}
	];

	// Helper functions
	function getUniqueId(): number {
		return nextId++;
	}

	function getPointById(id: number | null): Point | undefined {
		if (id === null) return undefined;
		return points.find((p) => p.id === id);
	}

	function getSVGCoordinates(event: MouseEvent | PointerEvent): Coordinates | null {
		if (!svgCanvasEl) return null;
		const pt = svgCanvasEl.createSVGPoint();
		pt.x = event.clientX;
		pt.y = event.clientY;
		const svgScreenCTM = svgCanvasEl.getScreenCTM();
		if (!svgScreenCTM) return null;

		try {
			const transformedPt = pt.matrixTransform(svgScreenCTM.inverse());

			// Clamp Y to 0-100 (fixed viewBox height)
			transformedPt.y = Math.max(0, Math.min(100, transformedPt.y));
			// Clamp X to 0 to current viewBoxWidth
			transformedPt.x = Math.max(0, Math.min(viewBoxWidth, transformedPt.x));

			return { x: transformedPt.x, y: transformedPt.y };
		} catch (e) {
			console.error('Error transforming point:', e);
			return null;
		}
	}

	function findNearestPoint(coords: Coordinates, threshold: number = 5): Point | null {
		const thresholdSq = threshold * threshold;
		let nearest: Point | null = null;
		let minDistSq = Infinity;

		for (const point of points) {
			const dx = point.x - coords.x;
			const dy = point.y - coords.y;
			const distSq = dx * dx + dy * dy;

			if (distSq < minDistSq && distSq < thresholdSq) {
				minDistSq = distSq;
				nearest = point;
			}
		}
		return nearest;
	}

	function isPointHighlighted(pointId: number): boolean {
		return pointId === tempLineStartPointId || pointId === draggingPointId;
	}

	function activatePoint(pointId: number) {
		if (currentTool === 'delete') {
			points = points.filter((p) => p.id !== pointId);
			lines = lines.filter((l) => l.p1Id !== pointId && l.p2Id !== pointId);
			return;
		}

		if (currentTool === 'line') {
			if (tempLineStartPointId === null) {
				tempLineStartPointId = pointId;
				return;
			}

			if (tempLineStartPointId !== pointId) {
				const exists = lines.some(
					(l) =>
						(l.p1Id === tempLineStartPointId && l.p2Id === pointId) ||
						(l.p1Id === pointId && l.p2Id === tempLineStartPointId)
				);
				if (!exists) {
					lines = [...lines, { id: getUniqueId(), p1Id: tempLineStartPointId, p2Id: pointId }];
				}
			}
			tempLineStartPointId = null;
			currentPointerPos = null;
		}
	}

	// Computed grid lines (matching production implementation)
	let gridLines = $derived.by(() => {
		const lines = {
			majorVertical: [] as number[],
			majorHorizontal: [] as number[],
			minorVertical: [] as number[],
			minorHorizontal: [] as number[]
		};
		const currentViewBoxWidth = viewBoxWidth;

		// Horizontal Lines (Fixed Y, extend across current viewBox width)
		for (let i = 0; i <= MAJOR_VERTICAL_DIVISIONS; i++) {
			const yPos = i * DESIRED_MAJOR_CELL_SIZE_SVG; // 0, 20, 40, 60, 80, 100
			lines.majorHorizontal.push(yPos);
			if (i < MAJOR_VERTICAL_DIVISIONS) {
				for (let j = 1; j < SUBGRID_DIVISIONS; j++) {
					lines.minorHorizontal.push(yPos + j * DESIRED_MINOR_CELL_SIZE_SVG);
				}
			}
		}

		// Vertical Lines (Fixed X spacing, up to current viewBox width)
		let currentX = 0;
		while (currentX <= currentViewBoxWidth) {
			lines.majorVertical.push(currentX);
			if (currentX < currentViewBoxWidth) {
				for (let j = 1; j < SUBGRID_DIVISIONS; j++) {
					const minorX = currentX + j * DESIRED_MINOR_CELL_SIZE_SVG;
					if (minorX <= currentViewBoxWidth) {
						lines.minorVertical.push(minorX);
					} else {
						break;
					}
				}
			}
			if (DESIRED_MAJOR_CELL_SIZE_SVG <= 0) break;
			currentX += DESIRED_MAJOR_CELL_SIZE_SVG;
		}

		return lines;
	});

	// Event handlers
	function setTool(tool: Tool) {
		currentTool = tool;
		tempLineStartPointId = null;
		draggingPointId = null;
		currentPointerPos = null;
	}

	function handleCanvasClick(event: MouseEvent) {
		const coords = getSVGCoordinates(event);
		if (!coords) return;

		const nearestPoint = findNearestPoint(coords, DESIRED_MINOR_CELL_SIZE_SVG);

		switch (currentTool) {
			case 'point':
				// Add point exactly where clicked in the current viewBox space
				points = [...points, { id: getUniqueId(), x: coords.x, y: coords.y }];
				break;

			case 'line':
				// If near an existing point, use it. Otherwise, create a new one.
				const targetPoint = nearestPoint ?? { id: getUniqueId(), x: coords.x, y: coords.y };
				if (!nearestPoint) {
					points = [...points, targetPoint]; // Add if it's a new location
				}

				if (tempLineStartPointId === null) {
					tempLineStartPointId = targetPoint.id;
				} else {
					if (tempLineStartPointId !== targetPoint.id) {
						const exists = lines.some(
							(l) =>
								(l.p1Id === tempLineStartPointId && l.p2Id === targetPoint.id) ||
								(l.p1Id === targetPoint.id && l.p2Id === tempLineStartPointId)
						);
						if (!exists) {
							lines = [
								...lines,
								{
									id: getUniqueId(),
									p1Id: tempLineStartPointId,
									p2Id: targetPoint.id
								}
							];
						}
					}
					tempLineStartPointId = null;
					currentPointerPos = null;
				}
				break;

			case 'delete':
				// Use a smaller threshold for precise deletion
				const pointToDelete = findNearestPoint(coords, 2);
				if (pointToDelete) {
					// Remove the point
					points = points.filter((p) => p.id !== pointToDelete.id);
					// Remove lines connected to this point
					lines = lines.filter(
						(l) => l.p1Id !== pointToDelete.id && l.p2Id !== pointToDelete.id
					);
				}
				break;

			case 'selector':
				tempLineStartPointId = null; // Cancel line drawing if clicking away
				currentPointerPos = null;
				break;
		}
	}

	function handlePointPointerDown(pointId: number, event: PointerEvent) {
		if (currentTool !== 'selector') return;
		draggingPointId = pointId;
		(event.target as Element).setPointerCapture(event.pointerId);
	}

	function handleCanvasMouseMove(event: PointerEvent) {
		const coords = getSVGCoordinates(event);
		if (!coords) return;
		currentPointerPos = coords; // Update for temp line drawing

		if (draggingPointId !== null && currentTool === 'selector') {
			const point = getPointById(draggingPointId);
			if (point) {
				// Update stored coords (which are in the dynamic viewBox space)
				point.x = coords.x;
				point.y = coords.y; // Y is clamped 0-100 anyway
				points = points; // Trigger reactivity
			}
		}
	}

	function handlePointerUp(event: PointerEvent) {
		if (draggingPointId !== null) {
			if ((event.target as Element)?.hasPointerCapture(event.pointerId)) {
				(event.target as Element).releasePointerCapture(event.pointerId);
			}
			draggingPointId = null;
		}
		// Don't reset currentPointerPos if still drawing a line
		if (currentTool !== 'line' || tempLineStartPointId === null) {
			currentPointerPos = null;
		}
	}

	function handleClose() {
		coordinator?.hideTool(toolId);
	}

	function toggleSettings() {
		settingsOpen = !settingsOpen;
	}

	function closeSettings() {
		settingsOpen = false;
	}

	function handlePointerDown(e: PointerEvent) {
		const target = e.target as HTMLElement;

		// Only start drag if clicking the header
		if (!target.closest('.pie-tool-graph__header')) return;

		// Don't drag if clicking settings button
		if (target.closest('.tool-settings-button')) return;

		// Start dragging (we'll handle position updates)
		if (containerEl) {
			containerEl.setPointerCapture(e.pointerId);
			const startX = e.clientX - x;
			const startY = e.clientY - y;

			function onMove(e: PointerEvent) {
				let newX = e.clientX - startX;
				let newY = e.clientY - startY;

				// Keep calculator on screen
				const halfWidth = (containerEl?.offsetWidth || width) / 2;
				const halfHeight = (containerEl?.offsetHeight || height) / 2;

				x = Math.max(halfWidth, Math.min(newX, window.innerWidth - halfWidth));
				y = Math.max(halfHeight, Math.min(newY, window.innerHeight - halfHeight));
			}

			function onUp() {
				if (containerEl) {
					containerEl.releasePointerCapture(e.pointerId);
				}
				containerEl?.removeEventListener('pointermove', onMove);
				containerEl?.removeEventListener('pointerup', onUp);
			}

			containerEl.addEventListener('pointermove', onMove);
			containerEl.addEventListener('pointerup', onUp);
			coordinator?.bringToFront(containerEl);
		}
	}

	// ResizeObserver for dynamic viewBox width (matching production implementation)
	let resizeObserver: ResizeObserver | null = null;
	$effect(() => {
		if (canvasWrapperEl) {
			if (!resizeObserver) {
				resizeObserver = new ResizeObserver((entries) => {
					const entry = entries[0];
					const { width: wrapperWidth, height: wrapperHeight } = entry.contentRect;

					// Update pixel dimensions only if they actually changed
					if (
						Math.abs(containerPixelWidth - wrapperWidth) > 0.1 ||
						Math.abs(containerPixelHeight - wrapperHeight) > 0.1
					) {
						containerPixelWidth = wrapperWidth;
						containerPixelHeight = wrapperHeight;
					}
				});
			}
			resizeObserver.observe(canvasWrapperEl);

			return () => {
				if (resizeObserver) {
					resizeObserver.disconnect();
				}
			};
		}
	});

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			if (containerEl) {
				coordinator.registerTool(toolId, 'Graph Tool', containerEl, ZIndexLayer.MODAL);
			} else {
				coordinator.registerTool(toolId, 'Graph Tool', undefined, ZIndexLayer.MODAL);
			}
			registered = true;
		}
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
			coordinator.bringToFront(containerEl);
		}
	});

	onMount(() => {
		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
				resizeObserver = null;
			}
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});
</script>

{#if visible}
	<div
		bind:this={containerEl}
		class="pie-tool-graph"
		role="dialog"
		tabindex="-1"
		aria-label="Graph Tool - Draw points and lines on a coordinate grid"
		style="left: {x}px; top: {y}px; width: {width}px; height: {height}px; transform: translate(-50%, -50%);"
		onpointerdown={handlePointerDown}
	>
		<!-- Header (matching production implementation: dark teal) -->
		<div class="pie-tool-graph__header">
			<h3 id="graph-tool-title" class="pie-tool-graph__title">Graph Tool</h3>
			<div class="pie-tool-graph__header-controls">
				<ToolSettingsButton
					bind:buttonEl={settingsButtonEl}
					onClick={toggleSettings}
					ariaLabel="Graph tool settings"
					active={settingsOpen}
				/>
			</div>
		</div>

		<!-- Toolbar (matching production implementation: lighter teal) -->
		<div class="pie-tool-graph__toolbar">
			<!-- Tool buttons -->
			<div class="pie-tool-graph__tool-buttons">
				{#each tools as tool (tool.name)}
					<button
						type="button"
						class="pie-tool-graph__tool-button"
						class:pie-tool-graph__tool-button--active={currentTool === tool.name}
						onclick={() => setTool(tool.name)}
						title={tool.title}
						aria-label={tool.title}
						aria-pressed={currentTool === tool.name}
					>
						<span class="pie-tool-graph__tool-icon" aria-hidden="true">
							{#if tool.name === 'selector'}
								<!-- Selector icon (swirling arrow) -->
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
								</svg>
							{:else if tool.name === 'point'}
								<!-- Point icon (pushpin) -->
								<svg viewBox="0 0 24 24" fill="currentColor">
									<path
										d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
									/>
								</svg>
							{:else if tool.name === 'line'}
								<!-- Line icon (pencil) -->
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path
										d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
									/>
								</svg>
							{:else if tool.name === 'delete'}
								<!-- Delete icon (trash) -->
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path
										d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
									/>
								</svg>
							{/if}
						</span>
						<span class="pie-tool-graph__tool-label">{tool.label}</span>
					</button>
				{/each}
			</div>

			<!-- Grid opacity slider (matching production implementation) -->
			<div class="pie-tool-graph__transparency-control">
				<label for="grid-opacity">Grid:</label>
				<input
					type="range"
					id="grid-opacity"
					min="0"
					max="1"
					step="0.1"
					bind:value={gridOpacity}
					aria-label="Grid opacity"
				/>
			</div>
		</div>

		<!-- Canvas wrapper -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			bind:this={canvasWrapperEl}
			class="pie-tool-graph__canvas-wrapper"
			role="img"
			tabindex="0"
			aria-label="Graph canvas - Use tools to add points and draw lines"
			onclick={handleCanvasClick}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleCanvasClick(e as any);
				}
			}}
		>
			<svg
				bind:this={svgCanvasEl}
				class="pie-tool-graph__canvas"
				viewBox="0 0 {viewBoxWidth} 100"
				preserveAspectRatio="xMinYMin meet"
				aria-hidden="true"
				onpointermove={handleCanvasMouseMove}
				onpointerup={handlePointerUp}
				onpointerleave={handlePointerUp}
			>
				<!-- Grid Lines -->
				<g class="pie-tool-graph__grid-lines" style="opacity: {gridOpacity}" aria-hidden="true">
					<!-- Minor Horizontal Lines -->
					{#each gridLines.minorHorizontal as yPos, index (index)}
						<line
							x1="0"
							y1={yPos}
							x2={viewBoxWidth}
							y2={yPos}
							class="pie-tool-graph__grid-line pie-tool-graph__grid-line--minor"
						/>
					{/each}
					<!-- Major Horizontal Lines -->
					{#each gridLines.majorHorizontal as yPos, index (index)}
						<line
							x1="0"
							y1={yPos}
							x2={viewBoxWidth}
							y2={yPos}
							class="pie-tool-graph__grid-line pie-tool-graph__grid-line--major"
						/>
					{/each}

					<!-- Minor Vertical Lines -->
					{#each gridLines.minorVertical as xPos, index (index)}
						<line
							x1={xPos}
							y1="0"
							x2={xPos}
							y2="100"
							class="pie-tool-graph__grid-line pie-tool-graph__grid-line--minor"
						/>
					{/each}
					<!-- Major Vertical Lines -->
					{#each gridLines.majorVertical as xPos, index (index)}
						<line
							x1={xPos}
							y1="0"
							x2={xPos}
							y2="100"
							class="pie-tool-graph__grid-line pie-tool-graph__grid-line--major"
						/>
					{/each}
				</g>

				<!-- Lines -->
				<g class="pie-tool-graph__lines">
					{#each lines as line (line.id)}
						{@const p1 = getPointById(line.p1Id)}
						{@const p2 = getPointById(line.p2Id)}
						{#if p1 && p2}
							<line
								x1={p1.x}
								y1={p1.y}
								x2={p2.x}
								y2={p2.y}
								class="pie-tool-graph__user-line"
							/>
						{/if}
					{/each}
				</g>

				<!-- Points -->
				<g class="pie-tool-graph__points">
					{#each points as point (point.id)}
						<circle
							cx={point.x}
							cy={point.y}
							r="2"
							class="pie-tool-graph__user-point"
							class:pie-tool-graph__user-point--highlight={isPointHighlighted(point.id)}
							data-id={point.id}
							role="button"
							tabindex="0"
							aria-label="Graph point {point.id}"
							onpointerdown={(e) => {
								e.stopPropagation();
								handlePointPointerDown(point.id, e);
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									activatePoint(point.id);
								}
							}}
						/>
					{/each}
				</g>

				<!-- Temporary line feedback -->
				{#if tempLineStartPointId && currentPointerPos}
					{@const startPoint = getPointById(tempLineStartPointId)}
					{#if startPoint}
						<line
							x1={startPoint.x}
							y1={startPoint.y}
							x2={currentPointerPos.x}
							y2={currentPointerPos.y}
							class="pie-tool-graph__temp-line"
						/>
					{/if}
				{/if}
			</svg>
		</div>
	</div>

	<!-- Settings Panel -->
	<ToolSettingsPanel
		open={settingsOpen}
		title="Graph Tool Settings"
		onClose={closeSettings}
		anchorEl={settingsButtonEl}
	>
		<fieldset class="pie-tool-graph__setting-group">
			<legend>Canvas</legend>
			<label>
				<span class="pie-tool-graph__setting-label">Grid Opacity</span>
				<input
					type="range"
					min="0"
					max="1"
					step="0.1"
					bind:value={gridOpacity}
					aria-label="Grid opacity"
				/>
			</label>
		</fieldset>
	</ToolSettingsPanel>
{/if}

<style>
	.pie-tool-graph {
		position: fixed;
		background: white;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		user-select: none;
		touch-action: none;
		border-radius: 12px;
		overflow: hidden;
		z-index: 2000; /* ZIndexLayer.MODAL */
		min-width: 500px;
		display: flex;
		flex-direction: column;
	}

	/* Header (matching production implementation: dark teal) */
	.pie-tool-graph__header {
		padding: 12px 16px;
		background: var(--pie-primary-dark, #2c3e50); /* Dark teal-like color */
		color: var(--pie-white, white);
		display: flex;
		justify-content: space-between;
		align-items: center;
		cursor: move;
		user-select: none;
		border-radius: 12px 12px 0 0;
	}

	.pie-tool-graph__title {
		font-weight: 600;
		font-size: 16px;
		color: var(--pie-white, white);
		margin: 0;
	}

	.pie-tool-graph__header-controls {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* Toolbar (matching production implementation: lighter teal) */
	.pie-tool-graph__toolbar {
		padding: 8px;
		background: var(--pie-primary-light, #5a7fa3); /* Lighter teal-like color */
		display: flex;
		gap: 16px;
		align-items: center;
		flex-wrap: wrap;
	}

	.pie-tool-graph__tool-buttons {
		display: flex;
		gap: 4px;
		flex: 1;
	}

	.pie-tool-graph__tool-button {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		background: rgba(255, 255, 255, 0.2);
		border: 2px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		color: white;
		font-size: 12px;
		transition: all 0.2s;
	}

	.pie-tool-graph__tool-button:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.pie-tool-graph__tool-button.pie-tool-graph__tool-button--active {
		background: white;
		color: var(--pie-primary-dark, #2c3e50);
		border-color: var(--pie-primary-dark, #2c3e50);
	}

	.pie-tool-graph__tool-icon {
		width: 20px;
		height: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pie-tool-graph__tool-label {
		font-size: 11px;
		font-weight: 500;
	}

	.pie-tool-graph__transparency-control {
		display: flex;
		align-items: center;
		gap: 8px;
		color: white;
		font-size: 12px;
		padding-left: 8px;
	}

	.pie-tool-graph__transparency-control label {
		font-weight: 500;
	}

	.pie-tool-graph__transparency-control input[type='range'] {
		width: 100px;
		cursor: pointer;
	}

	/* Canvas wrapper */
	.pie-tool-graph__canvas-wrapper {
		flex: 1;
		background: white;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.pie-tool-graph__canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* Grid lines (matching production implementation: dark gray) */
	.pie-tool-graph__grid-line {
		stroke: var(--pie-primary-console, #666);
		vector-effect: non-scaling-stroke;
	}

	.pie-tool-graph__grid-line--major {
		stroke: var(--pie-primary-dark-console, #333);
		stroke-width: 0.75;
	}

	.pie-tool-graph__grid-line--minor {
		stroke: var(--pie-primary-light-console, #ccc);
		stroke-width: 0.5;
	}

	/* User drawing styles */
	.pie-tool-graph__user-point {
		cursor: pointer;
		fill: var(--pie-primary, #3f51b5);
		stroke: var(--pie-primary-dark, #2c3e50);
		stroke-width: 0.5;
		vector-effect: non-scaling-stroke;
	}

	.pie-tool-graph__user-point.pie-tool-graph__user-point--highlight {
		fill: var(--pie-warning, #ffc107);
		stroke: var(--pie-warning-dark, #ff9800);
	}

	.pie-tool-graph__user-line {
		stroke: var(--pie-dark-gray, #333);
		stroke-linecap: round;
		stroke-width: 1;
		vector-effect: non-scaling-stroke;
	}

	.pie-tool-graph__temp-line {
		pointer-events: none;
		stroke: var(--pie-success, #4caf50);
		stroke-dasharray: 2, 2;
		stroke-width: 0.75;
		vector-effect: non-scaling-stroke;
	}

	.pie-tool-graph__setting-group {
		border: 1px solid var(--pie-border, #ccc);
		border-radius: 4px;
		padding: 12px;
		margin-bottom: 16px;
	}

	.pie-tool-graph__setting-group legend {
		font-weight: 600;
		padding: 0 8px;
	}

	.pie-tool-graph__setting-label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
	}
</style>
