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

	const DEFAULT_COLORS = ['#075985', '#9f1239', '#166534', '#6b21a8', '#9a3412', '#334155'];
	const COLOR_PROPERTIES = [
		'--pie-calculator-series-1',
		'--pie-calculator-series-2',
		'--pie-calculator-series-3',
		'--pie-calculator-series-4',
		'--pie-calculator-series-5',
		'--pie-calculator-series-6',
	];
	const DEFAULT_COLOR_PROPERTIES = [
		'--cortex-default-series-1',
		'--cortex-default-series-2',
		'--cortex-default-series-3',
		'--cortex-default-series-4',
		'--cortex-default-series-5',
		'--cortex-default-series-6',
	];
	const DASHES = { solid: 0, dashed: 2, dotted: 1 } as const;
	const i18n = $derived(controller.settings.localization);

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
				strokeColor: seriesColor(expression.colorIndex),
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

	function seriesColor(colorIndex: number): string {
		const fallback = DEFAULT_COLORS[colorIndex] ?? DEFAULT_COLORS[0] ?? '#075985';
		const property = COLOR_PROPERTIES[colorIndex] ?? COLOR_PROPERTIES[0];
		const defaultProperty = DEFAULT_COLOR_PROPERTIES[colorIndex] ?? DEFAULT_COLOR_PROPERTIES[0];
		const calculator = graphElement?.closest<HTMLElement>('.pie-cortex-calculator');
		if (!calculator || !property) return fallback;
		const styles = getComputedStyle(calculator);
		return (
			styles.getPropertyValue(property).trim() ||
			(defaultProperty ? styles.getPropertyValue(defaultProperty).trim() : '') ||
			fallback
		);
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
		return i18n.t('graphExpressionLabel', {
			index: index + 1,
			lineStyle: i18n.lineStyle(expression.lineStyle),
		});
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
	<section class="pie-cortex-expression-panel" aria-label={i18n.t('graphExpressions')}>
		{#each expressions as expression, index (expression.id)}
			<div class="pie-cortex-expression-row">
				<span
					class="pie-cortex-series-swatch pie-cortex-series-swatch--{expression.lineStyle} pie-cortex-series-swatch--color-{expression.colorIndex + 1}"
					aria-hidden="true"
				></span>
				<div class="pie-cortex-expression-input">
					<MathFieldInput
						value={expression.latex}
						label={graphExpressionLabel(expression, index)}
						type="graphing"
						localization={i18n}
						restrictedMode={controller.settings.restrictedMode}
						onInput={(latex) => updateExpression(expression.id, latex)}
					/>
					<span class="pie-cortex-series-description">
						{i18n.t('seriesDescription', {
							index: index + 1,
							lineStyle: i18n.lineStyle(expression.lineStyle),
						})}
					</span>
				</div>
				<button
					type="button"
					class="pie-cortex-icon-button"
					aria-pressed={expression.hidden}
					aria-label={i18n.t(expression.hidden ? 'showExpression' : 'hideExpression', { index: index + 1 })}
					onclick={() => {
						controller.toggleGraphExpression(expression.id);
						requestSample(0);
					}}
				>{expression.hidden ? i18n.t('show') : i18n.t('hide')}</button
				>
				<button
					type="button"
					class="pie-cortex-icon-button"
					aria-label={i18n.t('removeExpression', { index: index + 1 })}
					onclick={() => removeExpression(expression.id)}
				>{i18n.t('remove')}</button
				>
			</div>
		{/each}
		<button
			bind:this={addButton}
			type="button"
			class="pie-cortex-action-button"
			disabled={expressions.length >= 6}
			onclick={() => controller.addGraphExpression()}
		>{i18n.t('addExpression')}</button
		>
	</section>

	<section class="pie-cortex-graph-panel" aria-label={i18n.t('graph')}>
		<div class="pie-cortex-graph-controls">
			<button type="button" class="pie-cortex-action-button" onclick={resetViewport}>{i18n.t('resetView')}</button>
			<span role="status" aria-live="polite">{snapshot.graphUpdating ? i18n.t('updatingGraph') : ''}</span>
		</div>
		<div class="pie-cortex-jsxgraph" bind:this={graphElement} aria-hidden="true"></div>
		<div class="pie-cortex-graph-summary">
			<h3>{i18n.t('graphSummary')}</h3>
			{#if graph}
				<p>
					{i18n.t('viewportSummary', {
						xMin: i18n.formatNumber(graph.viewport.xMin, 4),
						xMax: i18n.formatNumber(graph.viewport.xMax, 4),
						yMin: i18n.formatNumber(graph.viewport.yMin, 4),
						yMax: i18n.formatNumber(graph.viewport.yMax, 4),
					})}
				</p>
				<ul>
					{#each expressions.filter((expression) => !expression.hidden && expression.latex.trim()) as expression, index}
						<li>{i18n.t('seriesSummary', {
							index: index + 1,
							lineStyle: i18n.lineStyle(expression.lineStyle),
							expression: expression.latex,
						})}</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="pie-cortex-trace" aria-label={i18n.t('keyboardGraphTrace')}>
			<h3>{i18n.t('keyboardTrace')}</h3>
			<label>
				{i18n.t('series')}
				<select bind:value={selectedTraceId} onchange={() => (traceIndex = 0)}>
					{#each snapshot.series as entry, index}
						<option value={entry.id}>{i18n.t('seriesOption', { index: index + 1 })}</option>
					{/each}
				</select>
			</label>
			<div class="pie-cortex-trace-controls">
				<button type="button" class="pie-cortex-action-button" disabled={!tracePoint} onclick={() => moveTrace(-1)}>
					{i18n.t('previousPoint')}
				</button>
				<button type="button" class="pie-cortex-action-button" disabled={!tracePoint} onclick={() => moveTrace(1)}>
					{i18n.t('nextPoint')}
				</button>
			</div>
			<p role="status" aria-live="polite" aria-atomic="true">
				{#if tracePoint}
					{i18n.t('tracePoint', {
						x: i18n.formatNumber(tracePoint.x),
						y: i18n.formatNumber(tracePoint.y),
					})}
				{:else}
					{i18n.t('noSampledPoint')}
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

	.pie-cortex-series-swatch--color-1 {
		border-top-color: var(--pie-calculator-series-1, var(--cortex-default-series-1, #075985));
	}

	.pie-cortex-series-swatch--color-2 {
		border-top-color: var(--pie-calculator-series-2, var(--cortex-default-series-2, #9f1239));
	}

	.pie-cortex-series-swatch--color-3 {
		border-top-color: var(--pie-calculator-series-3, var(--cortex-default-series-3, #166534));
	}

	.pie-cortex-series-swatch--color-4 {
		border-top-color: var(--pie-calculator-series-4, var(--cortex-default-series-4, #6b21a8));
	}

	.pie-cortex-series-swatch--color-5 {
		border-top-color: var(--pie-calculator-series-5, var(--cortex-default-series-5, #9a3412));
	}

	.pie-cortex-series-swatch--color-6 {
		border-top-color: var(--pie-calculator-series-6, var(--cortex-default-series-6, #334155));
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
		border: 1px solid var(--pie-button-border, var(--pie-border, #64748b));
		border-radius: 0.35rem;
		background: var(--pie-button-bg, var(--pie-background, #fff));
		color: var(--pie-button-color, var(--pie-text, #0f172a));
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
		background: var(--pie-background-dark, var(--pie-background, #fff));
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
