<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import MathFieldInput from './MathFieldInput.svelte';
	import type {
		CortexCalculatorController,
		CortexCalculatorSnapshot,
	} from './calculator-controller.js';
	import type {
		CortexGraphExpressionState,
		CortexGraphViewport,
	} from './types.js';
	import type { SampledSeries } from './worker-protocol.js';

	let {
		controller,
		snapshot,
	}: {
		controller: CortexCalculatorController;
		snapshot: CortexCalculatorSnapshot;
	} = $props();

	interface JsxCurve {
		dataX: number[];
		dataY: number[];
		setAttribute(attributes: Record<string, unknown>): void;
	}

	interface JsxBoard {
		create(type: string, parameters: unknown[], attributes?: Record<string, unknown>): unknown;
		fullUpdate(): void;
		getBoundingBox(): [number, number, number, number];
		setBoundingBox(bounds: [number, number, number, number], keepAspectRatio?: boolean): void;
		resizeContainer(width: number, height: number, preserveCss?: boolean, preserveBounds?: boolean): void;
		removeObject(object: unknown): void;
		on(event: string, handler: () => void): void;
	}

	interface JsxGraphModule {
		JSXGraph: {
			initBoard(element: HTMLElement, attributes: Record<string, unknown>): JsxBoard;
			freeBoard(board: JsxBoard): void;
		};
	}

	const COLORS = ['#075985', '#9f1239', '#166534', '#6b21a8', '#9a3412', '#334155'];
	const DASHES = { solid: 0, dashed: 2, dotted: 1 } as const;

	let graphElement = $state<HTMLDivElement | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);
	let board: JsxBoard | null = null;
	let graphModule: JsxGraphModule | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let sampleTimer: ReturnType<typeof setTimeout> | null = null;
	let previousBounds = '';
	let previousSize = '';
	let selectedTraceId = $state('');
	let traceIndex = $state(0);
	const curves = new Map<string, JsxCurve>();

	const graph = $derived(snapshot.graph);
	const expressions = $derived(graph?.expressions ?? []);
	const expressionSampleKey = $derived(
		expressions
			.map((expression) => `${expression.id}:${expression.hidden}:${expression.latex}`)
			.join('|'),
	);
	const selectedSeries = $derived(
		snapshot.series.find((entry) => entry.id === selectedTraceId) ?? snapshot.series[0],
	);
	const tracePoints = $derived(
		selectedSeries
			? selectedSeries.x
					.map((x, index) => ({ x, y: selectedSeries.y[index] }))
					.filter((point): point is { x: number; y: number } => Number.isFinite(point.y))
			: [],
	);
	const tracePoint = $derived(tracePoints[Math.min(traceIndex, Math.max(0, tracePoints.length - 1))]);

	function viewportFromBoard(): CortexGraphViewport | null {
		if (!board) return null;
		const [xMin, yMax, xMax, yMin] = board.getBoundingBox();
		if (![xMin, xMax, yMin, yMax].every(Number.isFinite)) return null;
		return { xMin, xMax, yMin, yMax };
	}

	function requestSample(delay = 120): void {
		if (sampleTimer) clearTimeout(sampleTimer);
		sampleTimer = setTimeout(() => {
			sampleTimer = null;
			const viewport = viewportFromBoard() ?? graph?.viewport;
			if (!viewport || !graphElement) return;
			void controller.sampleGraph(viewport, graphElement.clientWidth || 600);
		}, delay);
	}

	function boardUpdated(): void {
		const viewport = viewportFromBoard();
		if (!viewport) return;
		const nextBounds = `${viewport.xMin}:${viewport.xMax}:${viewport.yMin}:${viewport.yMax}`;
		if (nextBounds === previousBounds) return;
		previousBounds = nextBounds;
		requestSample();
	}

	function resizeBoard(): boolean {
		if (!board || !graphElement) return false;
		const width = graphElement.clientWidth;
		const height = graphElement.clientHeight;
		const size = `${width}:${height}`;
		if (size === previousSize) return false;
		previousSize = size;
		board.resizeContainer(width, height, true, true);
		return true;
	}

	function updateCurves(series: readonly SampledSeries[]): void {
		if (!board) return;
		const activeIds = new Set(series.map((entry) => entry.id));
		for (const [id, curve] of curves) {
			if (activeIds.has(id)) continue;
			board.removeObject(curve);
			curves.delete(id);
		}
		for (const entry of series) {
			const expression = expressions.find((candidate) => candidate.id === entry.id);
			if (!expression) continue;
			const attributes = {
				strokeColor: COLORS[expression.colorIndex] ?? COLORS[0],
				strokeWidth: 3,
				dash: DASHES[expression.lineStyle],
				fixed: true,
				highlight: false,
			};
			const existing = curves.get(entry.id);
			if (existing) {
				existing.dataX = [...entry.x];
				existing.dataY = [...entry.y];
				existing.setAttribute(attributes);
			} else {
				const curve = board.create('curve', [[...entry.x], [...entry.y]], attributes) as JsxCurve;
				curves.set(entry.id, curve);
			}
		}
		board.fullUpdate();
	}

	$effect(() => {
		const series = snapshot.series;
		untrack(() => updateCurves(series));
	});

	$effect(() => {
		void expressionSampleKey;
		untrack(() => requestSample(0));
	});

	$effect(() => {
		void snapshot.resizeRequest;
		untrack(() => {
			if (!resizeBoard()) return;
			requestSample(0);
		});
	});

	function graphExpressionLabel(expression: CortexGraphExpressionState, index: number): string {
		return `Graph expression ${index + 1}, ${expression.lineStyle} line`;
	}

	function removeExpression(id: string): void {
		controller.removeGraphExpression(id);
		queueMicrotask(() => addButton?.focus());
		requestSample(0);
	}

	function updateExpression(id: string, latex: string): void {
		controller.setGraphExpression(id, latex);
		requestSample(180);
	}

	function resetViewport(): void {
		if (!board) return;
		const viewport = controller.settings.graph.viewport;
		board.setBoundingBox(
			[viewport.xMin, viewport.yMax, viewport.xMax, viewport.yMin],
			false,
		);
		requestSample(0);
	}

	function moveTrace(direction: -1 | 1): void {
		if (tracePoints.length === 0) return;
		traceIndex = Math.min(tracePoints.length - 1, Math.max(0, traceIndex + direction));
	}

	onMount(() => {
		let cancelled = false;
		void import('jsxgraph').then((module) => {
			if (cancelled || !graphElement || !graph) return;
			graphModule = module.default as unknown as JsxGraphModule;
			const viewport = graph.viewport;
			board = graphModule.JSXGraph.initBoard(graphElement, {
				boundingbox: [viewport.xMin, viewport.yMax, viewport.xMax, viewport.yMin],
				axis: controller.settings.graph.showAxes,
				grid: controller.settings.graph.showGrid,
				showNavigation: false,
				showCopyright: false,
				pan: { enabled: true },
				zoom: { enabled: true, wheel: true, pinch: true },
				keepAspectRatio: false,
			});
			previousBounds = board.getBoundingBox().join(':');
			previousSize = `${graphElement.clientWidth}:${graphElement.clientHeight}`;
			board.on('update', boardUpdated);
			resizeObserver = new ResizeObserver(() => {
				if (resizeBoard()) requestSample();
			});
			resizeObserver.observe(graphElement);
			updateCurves(snapshot.series);
			requestSample(0);
		});

		return () => {
			cancelled = true;
			if (sampleTimer) clearTimeout(sampleTimer);
			sampleTimer = null;
			resizeObserver?.disconnect();
			resizeObserver = null;
			if (board && graphModule) graphModule.JSXGraph.freeBoard(board);
			board = null;
			graphModule = null;
			curves.clear();
		};
	});
</script>

<div class="pie-cortex-graph-layout">
	<section class="pie-cortex-expression-panel" aria-label="Graph expressions">
		{#each expressions as expression, index (expression.id)}
			<div class="pie-cortex-expression-row">
				<span
					class="pie-cortex-series-swatch pie-cortex-series-swatch--{expression.lineStyle}"
					style:border-top-color={COLORS[expression.colorIndex]}
					aria-hidden="true"
				></span>
				<div class="pie-cortex-expression-input">
					<MathFieldInput
						value={expression.latex}
						label={graphExpressionLabel(expression, index)}
						type="graphing"
						locale={controller.settings.locale}
						restrictedMode={controller.settings.restrictedMode}
						onInput={(latex) => updateExpression(expression.id, latex)}
					/>
					<span class="pie-cortex-series-description">
						Series {index + 1}: {expression.lineStyle} line
					</span>
				</div>
				<button
					type="button"
					class="pie-cortex-icon-button"
					aria-pressed={expression.hidden}
					aria-label={expression.hidden ? `Show expression ${index + 1}` : `Hide expression ${index + 1}`}
					onclick={() => {
						controller.toggleGraphExpression(expression.id);
						requestSample(0);
					}}
				>{expression.hidden ? 'Show' : 'Hide'}</button
				>
				<button
					type="button"
					class="pie-cortex-icon-button"
					aria-label={`Remove expression ${index + 1}`}
					onclick={() => removeExpression(expression.id)}
				>Remove</button
				>
			</div>
		{/each}
		<button
			bind:this={addButton}
			type="button"
			class="pie-cortex-action-button"
			disabled={expressions.length >= 6}
			onclick={() => controller.addGraphExpression()}
		>Add expression</button
		>
	</section>

	<section class="pie-cortex-graph-panel" aria-label="Graph">
		<div class="pie-cortex-graph-controls">
			<button type="button" class="pie-cortex-action-button" onclick={resetViewport}>Reset view</button>
			<span role="status" aria-live="polite">{snapshot.graphUpdating ? 'Updating graph' : ''}</span>
		</div>
		<div class="pie-cortex-jsxgraph" bind:this={graphElement} aria-hidden="true"></div>
		<div class="pie-cortex-graph-summary">
			<h3>Graph summary</h3>
			{#if graph}
				<p>
					Viewport x from {graph.viewport.xMin.toPrecision(4)} to {graph.viewport.xMax.toPrecision(4)},
					y from {graph.viewport.yMin.toPrecision(4)} to {graph.viewport.yMax.toPrecision(4)}.
				</p>
				<ul>
					{#each expressions.filter((expression) => !expression.hidden && expression.latex.trim()) as expression, index}
						<li>Series {index + 1}, {expression.lineStyle}: {expression.latex}</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="pie-cortex-trace" aria-label="Keyboard graph trace">
			<h3>Keyboard trace</h3>
			<label>
				Series
				<select bind:value={selectedTraceId} onchange={() => (traceIndex = 0)}>
					{#each snapshot.series as entry, index}
						<option value={entry.id}>Series {index + 1}</option>
					{/each}
				</select>
			</label>
			<div class="pie-cortex-trace-controls">
				<button type="button" class="pie-cortex-action-button" disabled={!tracePoint} onclick={() => moveTrace(-1)}>
					Previous point
				</button>
				<button type="button" class="pie-cortex-action-button" disabled={!tracePoint} onclick={() => moveTrace(1)}>
					Next point
				</button>
			</div>
			<p role="status" aria-live="polite" aria-atomic="true">
				{#if tracePoint}
					x {tracePoint.x.toPrecision(6)}, y {tracePoint.y.toPrecision(6)}
				{:else}
					No sampled graph point is available.
				{/if}
			</p>
		</div>
	</section>
</div>

<style>
	.pie-cortex-graph-layout {
		display: grid;
		grid-template-columns: minmax(16rem, 2fr) minmax(18rem, 3fr);
		gap: 1rem;
		min-width: 0;
	}

	.pie-cortex-expression-panel,
	.pie-cortex-graph-panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		min-width: 0;
	}

	.pie-cortex-expression-row {
		display: grid;
		grid-template-columns: 1rem minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.45rem;
	}

	.pie-cortex-expression-input {
		min-width: 0;
	}

	.pie-cortex-series-swatch {
		display: block;
		width: 1rem;
		border-top-width: 3px;
		border-top-style: solid;
	}

	.pie-cortex-series-swatch--dashed {
		border-top-style: dashed;
	}

	.pie-cortex-series-swatch--dotted {
		border-top-style: dotted;
	}

	.pie-cortex-series-description {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.8rem;
	}

	.pie-cortex-icon-button,
	.pie-cortex-action-button,
	select {
		min-height: 2.75rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--pie-border, #64748b);
		border-radius: 0.35rem;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #0f172a);
		font: inherit;
		cursor: pointer;
	}

	.pie-cortex-icon-button:focus-visible,
	.pie-cortex-action-button:focus-visible,
	select:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, #2563eb);
		outline-offset: 2px;
	}

	.pie-cortex-jsxgraph {
		width: 100%;
		height: min(26rem, 55vh);
		min-height: 18rem;
		border: 1px solid var(--pie-border, #64748b);
		background: var(--pie-background, #fff);
		touch-action: none;
	}

	.pie-cortex-graph-controls,
	.pie-cortex-trace-controls {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.pie-cortex-graph-summary,
	.pie-cortex-trace {
		padding: 0.75rem;
		border: 1px solid var(--pie-border, #94a3b8);
		border-radius: 0.35rem;
	}

	h3,
	p {
		margin: 0 0 0.5rem;
	}

	@media (max-width: 48rem) {
		.pie-cortex-graph-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.pie-cortex-expression-row {
			grid-template-columns: 1rem minmax(0, 1fr);
		}

		.pie-cortex-icon-button {
			grid-column: 2;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}
	}
</style>
