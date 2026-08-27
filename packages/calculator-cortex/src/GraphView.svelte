<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import Keypad from './Keypad.svelte';
	import MathFieldInput from './MathFieldInput.svelte';
	import type {
		CortexCalculatorController,
		CortexCalculatorSnapshot,
	} from './calculator-controller.js';
	import type { KeypadKey, KeypadLayer } from './keypad-layouts.js';
	import type {
		CortexCalculatorMessageKey,
		CortexGraphExpressionState,
		CortexGraphViewport,
	} from './types.js';
	import type { SampledSeries } from './worker-protocol.js';

	let {
		controller,
		snapshot,
		layers,
	}: {
		controller: CortexCalculatorController;
		snapshot: CortexCalculatorSnapshot;
		layers: readonly KeypadLayer[];
	} = $props();

	interface JsxCurve {
		dataX: number[];
		dataY: number[];
		setAttribute(attributes: Record<string, unknown>): void;
	}

	interface JsxAxis {
		setAttribute(attributes: Record<string, unknown>): void;
	}

	interface JsxBoard {
		create(type: string, parameters: unknown[], attributes?: Record<string, unknown>): unknown;
		fullUpdate(): void;
		getBoundingBox(): [number, number, number, number];
		/*
		 * JSXGraph's own navigation, the methods its navigation bar calls.
		 *
		 * `setBoundingBox` is deliberately not used: on its own it recomputes the
		 * units and moves the origin but never calls `applyZoom`, and its default
		 * third argument resets `zoomX`/`zoomY` to 1 — so the next update recomputed
		 * the old box and the call had no observable effect. `Reset view` was built
		 * on it and silently did nothing.
		 */
		zoomIn(): void;
		zoomOut(): void;
		zoom100(): void;
		clickLeftArrow(): void;
		clickRightArrow(): void;
		clickUpArrow(): void;
		clickDownArrow(): void;
		resizeContainer(width: number, height: number, preserveCss?: boolean, preserveBounds?: boolean): void;
		removeObject(object: unknown): void;
		on(event: string, handler: () => void): void;
		defaultAxes?: { x?: JsxAxis; y?: JsxAxis };
		grids?: JsxAxis[];
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
	let expressionPanel = $state<HTMLElement | null>(null);
	let board: JsxBoard | null = null;
	let graphModule: JsxGraphModule | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let sampleTimer: ReturnType<typeof setTimeout> | null = null;
	let previousBounds = '';
	let previousSize = '';
	let selectedTraceId = $state('');
	let traceIndex = $state(0);
	let activeField = $state<import('mathlive').MathfieldElement | null>(null);
	let announcement = $state('');
	let selectedLayerId = $state('');
	const curves = new Map<string, JsxCurve>();

	const activeLayerId = $derived(
		layers.some((layer) => layer.id === selectedLayerId)
			? selectedLayerId
			: (layers[0]?.id ?? ''),
	);
	const graph = $derived(snapshot.graph);
	const expressions = $derived(graph?.expressions ?? []);
	const expressionSampleKey = $derived(
		expressions
			.map((expression) => `${expression.id}:${expression.hidden}:${expression.latex}`)
			.join('|'),
	);
	// Fall back to the first series so the `<select>` always has a selected option.
	// It used to start at '' while the readout traced series 1 regardless, so the
	// combobox reported `selectedIndex: -1` — no value for AT, and visibly empty.
	const effectiveTraceId = $derived(
		snapshot.series.some((entry) => entry.id === selectedTraceId)
			? selectedTraceId
			: (snapshot.series[0]?.id ?? ''),
	);
	const selectedSeries = $derived(
		snapshot.series.find((entry) => entry.id === effectiveTraceId),
	);
	const tracePoints = $derived(
		selectedSeries
			? selectedSeries.x
					.map((x, index) => ({ x, y: selectedSeries.y[index] }))
					.filter((point): point is { x: number; y: number } => Number.isFinite(point.y))
			: [],
	);
	const tracePoint = $derived(tracePoints[Math.min(traceIndex, Math.max(0, tracePoints.length - 1))]);

	function resolveToken(property: string, fallbackProperty: string, fallback: string): string {
		const calculator = graphElement?.closest<HTMLElement>('.pie-cortex-calculator');
		if (!calculator) return fallback;
		const styles = getComputedStyle(calculator);
		return (
			styles.getPropertyValue(property).trim() ||
			styles.getPropertyValue(fallbackProperty).trim() ||
			fallback
		);
	}

	/**
	 * Axis, tick-label and grid colours for the board.
	 *
	 * JSXGraph was previously initialised with bare `axis: true` / `grid: true`, so
	 * it used its light-mode defaults in every theme: tick labels came out
	 * `fill: rgb(0, 0, 0)` on a `#1f2937` plot — 1.43:1, a 1.4.3 failure for text —
	 * and axes `#666666` at about 2.2:1, below 1.4.11's 3:1. Tick labels are text and
	 * take the 4.5:1 bar, so both take `--pie-text`; the grid is a subtle guide and
	 * takes the blue-grey step, since the axes and labels carry the information.
	 */
	function boardTheme(): {
		ink: string;
		grid: string;
	} {
		return {
			ink: resolveToken('--pie-text', '--cortex-text', '#0f172a'),
			grid: resolveToken('--pie-blue-grey-300', '--cortex-grid', '#c0c3cf'),
		};
	}

	function axisAttributes(ink: string): Record<string, unknown> {
		return {
			strokeColor: ink,
			strokeOpacity: 1,
			highlightStrokeColor: ink,
			ticks: {
				strokeColor: ink,
				majorHeight: 8,
				label: { strokeColor: ink, cssStyle: `fill: ${ink}; color: ${ink};` },
			},
			label: { strokeColor: ink },
		};
	}

	function applyBoardTheme(): void {
		if (!board) return;
		const { ink, grid } = boardTheme();
		const attributes = axisAttributes(ink);
		board.defaultAxes?.x?.setAttribute(attributes);
		board.defaultAxes?.y?.setAttribute(attributes);
		for (const line of board.grids ?? []) {
			line.setAttribute({ strokeColor: grid, strokeOpacity: 1 });
		}
		board.fullUpdate();
	}

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
		// The plot is now flex-sized rather than fixed, so it can be measured at 0
		// before first layout. Resizing to a zero box gives JSXGraph a degenerate
		// bounding box and it renders no SVG at all.
		if (width <= 0 || height <= 0) return false;
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
		if (!property || !defaultProperty) return fallback;
		return resolveToken(property, defaultProperty, fallback);
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

	/*
	 * Keyboard-operable pan, zoom and reset.
	 *
	 * JSXGraph's pointer bindings — drag, wheel, pinch — are the only way it moves
	 * the viewport on its own, so before these buttons a keyboard-only or
	 * switch-access learner could read the default window and nothing outside it:
	 * the trace moves within the sampled window and cannot leave it.
	 *
	 * The board's own navigation methods do the moving. They are what its
	 * navigation bar calls (hidden here by `showNavigation: false`), so the step
	 * sizes, the zoom limits and the commit are the library's rather than ours.
	 */
	function navigateBoard(move: (board: JsxBoard) => void): void {
		if (!board) return;
		move(board);
		requestSample(0);
	}

	function resetViewport(): void {
		navigateBoard((board) => board.zoom100());
	}

	const VIEWPORT_KEYS = [
		{ id: 'pan-left', glyph: '\u2190', nameKey: 'panLeft', move: (board: JsxBoard) => board.clickLeftArrow() },
		{ id: 'pan-right', glyph: '\u2192', nameKey: 'panRight', move: (board: JsxBoard) => board.clickRightArrow() },
		/*
		 * Crossed on purpose. JSXGraph's arrow methods name the direction the
		 * *content* moves, so `clickUpArrow` shifts the plot up and the visible y
		 * window down. A learner pressing "Pan up" means the window.
		 */
		{ id: 'pan-up', glyph: '\u2191', nameKey: 'panUp', move: (board: JsxBoard) => board.clickDownArrow() },
		{ id: 'pan-down', glyph: '\u2193', nameKey: 'panDown', move: (board: JsxBoard) => board.clickUpArrow() },
		{ id: 'zoom-out', glyph: '\u2212', nameKey: 'zoomOut', move: (board: JsxBoard) => board.zoomOut() },
		{ id: 'zoom-in', glyph: '+', nameKey: 'zoomIn', move: (board: JsxBoard) => board.zoomIn() },
	] as const satisfies readonly {
		id: string;
		glyph: string;
		nameKey: CortexCalculatorMessageKey;
		move: (board: JsxBoard) => void;
	}[];

	/*
	 * How many presses cross the whole series.
	 *
	 * A step of one sampled point made the control resolution-dependent and
	 * effectively unusable: the sampler takes one point per pixel, up to 1,200, so
	 * traversing a 600px plot cost 600 presses. A fixed number of stops keeps the
	 * traversal the same length whatever the plot is sampled at, and the readout
	 * still reports the exact sampled coordinate.
	 */
	const TRACE_STOPS = 40;

	function moveTrace(direction: -1 | 1): void {
		if (tracePoints.length === 0) return;
		const step = Math.max(1, Math.round(tracePoints.length / TRACE_STOPS));
		traceIndex = Math.min(
			tracePoints.length - 1,
			Math.max(0, traceIndex + direction * step),
		);
	}

	function insertKey(key: KeypadKey): void {
		const target = activeField ?? expressionPanel?.querySelector('math-field');
		if (!target) return;
		const field = target as import('mathlive').MathfieldElement;
		field.executeCommand(['insert', key.latex]);
		field.focus();
		announcement = i18n.t(key.nameKey, key.nameValues ?? {});
	}

	onMount(() => {
		let cancelled = false;
		let schemeQuery: MediaQueryList | null = null;
		const onSchemeChange = () => applyBoardTheme();
		void import('jsxgraph').then((module) => {
			if (cancelled || !graphElement || !graph) return;
			graphModule = module.default as unknown as JsxGraphModule;
			const viewport = graph.viewport;
			const { ink, grid } = boardTheme();
			board = graphModule.JSXGraph.initBoard(graphElement, {
				boundingbox: [viewport.xMin, viewport.yMax, viewport.xMax, viewport.yMin],
				axis: controller.settings.graph.showAxes,
				defaultAxes: {
					x: axisAttributes(ink),
					y: axisAttributes(ink),
				},
				grid: controller.settings.graph.showGrid
					? { strokeColor: grid, strokeOpacity: 1 }
					: false,
				showNavigation: false,
				showCopyright: false,
				pan: { enabled: true },
				zoom: { enabled: true, wheel: true, pinch: true },
				keepAspectRatio: false,
			});
			previousBounds = board.getBoundingBox().join(':');
			previousSize = `${graphElement.clientWidth}:${graphElement.clientHeight}`;
			board.on('update', boardUpdated);
			applyBoardTheme();
			resizeObserver = new ResizeObserver(() => {
				if (resizeBoard()) requestSample();
			});
			resizeObserver.observe(graphElement);
			updateCurves(snapshot.series);
			requestSample(0);
			// `theme: 'auto'` follows the OS, which can flip while the tool is open, and
			// the board's colours are baked in at init. Nothing else re-applies them.
			if (controller.settings.theme === 'auto' && typeof window !== 'undefined') {
				schemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
				schemeQuery.addEventListener('change', onSchemeChange);
			}
		});

		return () => {
			cancelled = true;
			schemeQuery?.removeEventListener('change', onSchemeChange);
			schemeQuery = null;
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
	<section
		class="pie-cortex-expression-panel"
		aria-label={i18n.t('graphExpressions')}
		bind:this={expressionPanel}
		onfocusin={(event) => {
			// `focusin` is composed, so a focus inside MathLive's shadow root retargets
			// to the host element — which is what the keypad needs to write into.
			const host = (event.target as Element | null)?.closest?.('math-field');
			if (host) activeField = host as import('mathlive').MathfieldElement;
		}}
	>
		<div class="pie-cortex-expression-list">
			{#each expressions as expression, index (expression.id)}
				<div class="pie-cortex-expression-row">
					<!--
						The colour chip is the show/hide control, so the legend and the toggle
						are one affordance instead of a decorative dash plus two text buttons.
						Its name is static and `aria-pressed` carries the state: the previous
						pairing flipped the name between "Show…"/"Hide…" *and* set
						`aria-pressed`, so AT announced "Show expression 1, toggle button,
						pressed" — the name asserting the action the state denies.
					-->
					<button
						type="button"
						class="pie-cortex-series-chip pie-cortex-series-chip--{expression.lineStyle} pie-cortex-series-chip--color-{expression.colorIndex + 1}"
						class:pie-cortex-series-chip--hidden={expression.hidden}
						aria-pressed={!expression.hidden}
						aria-label={i18n.t('seriesDescription', {
							index: index + 1,
							lineStyle: i18n.lineStyle(expression.lineStyle),
						})}
						onclick={() => {
							controller.toggleGraphExpression(expression.id);
							requestSample(0);
						}}
					>
						<span class="pie-cortex-series-chip__rule" aria-hidden="true"></span>
					</button>

					<div class="pie-cortex-expression-input">
						<MathFieldInput
							value={expression.latex}
							label={graphExpressionLabel(expression, index)}
							localization={i18n}
							restrictedMode={controller.settings.restrictedMode}
							focusRequest={index === 0 ? snapshot.focusRequest : 0}
									onInput={(latex) => updateExpression(expression.id, latex)}
							onFieldReady={(instance) => {
								if (instance && index === 0 && !activeField) activeField = instance;
							}}
						/>
						<!--
							Kept visible. It is the only non-colour cue telling a sighted
							colour-blind learner which line style belongs to which row, and it is
							the *visible* half of the pair — the field's `aria-label` duplicates
							it, not the reverse. A `title` tooltip would not substitute: it is
							unavailable to keyboard-only and touch users.
						-->
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
						aria-label={i18n.t('removeExpression', { index: index + 1 })}
						onclick={() => removeExpression(expression.id)}
					>
						<span aria-hidden="true">✕</span>
					</button>
				</div>
			{/each}
		</div>

		<div class="pie-cortex-expression-actions">
			<button
				bind:this={addButton}
				type="button"
				class="pie-cortex-action-button"
				disabled={expressions.length >= 6}
				onclick={() => controller.addGraphExpression()}
			>{i18n.t('addExpression')}</button>
			<button
				type="button"
				class="pie-cortex-action-button"
				onclick={() => controller.clear()}
			>{i18n.t('clear')}</button>
		</div>

		{#if layers.length > 1}
			<div class="pie-cortex-keypad__layers" role="group" aria-label={i18n.t('keypadLayer')}>
				{#each layers as layer (layer.id)}
					<button
						type="button"
						class="pie-cortex-layer-tab"
						class:pie-cortex-layer-tab--active={layer.id === activeLayerId}
						aria-pressed={layer.id === activeLayerId}
						onclick={() => (selectedLayerId = layer.id)}
					>{i18n.t(layer.labelKey)}</button>
				{/each}
			</div>
		{/if}
		<Keypad
			{layers}
			{activeLayerId}
			localization={i18n}
			onInsert={insertKey}
			onCommit={() => requestSample(0)}
		/>
	</section>

	<section class="pie-cortex-graph-panel" aria-label={i18n.t('graph')}>
		<div class="pie-cortex-graph-controls">
			<!--
				Real buttons with text accessible names and `aria-hidden` glyph faces:
				the glyph is the label a sighted learner reads, the name is what AT and
				voice control speak, and neither depends on the pointer.
			-->
			<div class="pie-cortex-viewport-controls" role="group" aria-label={i18n.t('viewportControls')}>
				{#each VIEWPORT_KEYS as key (key.id)}
					<button
						type="button"
						class="pie-cortex-action-button pie-cortex-viewport-button"
						aria-label={i18n.t(key.nameKey)}
						onclick={() => navigateBoard(key.move)}
					><span aria-hidden="true">{key.glyph}</span></button>
				{/each}
			</div>
			<button type="button" class="pie-cortex-action-button" onclick={resetViewport}>{i18n.t('resetView')}</button>
			<!-- Always mounted with empty text, so the region exists before it speaks. -->
			<span class="pie-cortex-graph-status" role="status" aria-live="polite"
				>{snapshot.graphUpdating ? i18n.t('updatingGraph') : ''}</span
			>
		</div>
		<div class="pie-cortex-jsxgraph" bind:this={graphElement} aria-hidden="true"></div>

		<!--
			One compact strip rather than two bordered panels. Every string stays
			rendered, visible and unconditionally in the accessibility tree: the plot
			itself is `aria-hidden`, so this text *is* the graph for AT, and PIE's own
			read-aloud excludes `.pie-sr-only` content, so hiding it would drop it from
			the TTS accommodation as well. Only the chrome was compacted, never the
			controls or their targets.
		-->
		<div class="pie-cortex-graph-readout">
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
				<label class="pie-cortex-trace__series">
					{i18n.t('series')}
					<select
						value={effectiveTraceId}
						onchange={(event) => {
							selectedTraceId = (event.currentTarget as HTMLSelectElement).value;
							traceIndex = 0;
						}}
					>
						{#each snapshot.series as entry, index (entry.id)}
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
				<p class="pie-cortex-trace__readout" role="status" aria-live="polite" aria-atomic="true">
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
		</div>
	</section>
</div>

<p class="pie-cortex-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

<style>
	.pie-cortex-graph-layout {
		display: flex;
		flex-direction: column;
		gap: var(--cortex-space-2, 0.5rem);
		flex: 1 1 auto;
		min-width: 0;
		min-height: 0;
	}

	/*
	 * Stacked by default, two columns only when this calculator — not the window —
	 * is wide enough to hold both. The previous `@media (max-width: 48rem)` measured
	 * the viewport, so inside the shipped 380px tool panel on a 1280px page it never
	 * fired: the grid stayed at its 34rem floor in a 333px box and the shell clipped
	 * the right 229px, most of the plot, with `overflow-x: hidden`.
	 */
	@container pie-cortex-calculator (min-width: 42rem) {
		.pie-cortex-graph-layout {
			display: grid;
			/* `minmax(0, 1fr)`, or the plot's own min-content width blocks shrinking. */
			grid-template-columns: minmax(15rem, 22rem) minmax(0, 1fr);
			/*
			 * And the row too. An `auto` row is content-sized, so the graph panel would
			 * grow to whatever the plot and the readout want and push the whole
			 * calculator past its panel — which the tool shell clips.
			 */
			grid-template-rows: minmax(0, 1fr);
			gap: var(--cortex-space-3, 0.75rem);
		}
	}

	.pie-cortex-expression-panel,
	.pie-cortex-graph-panel {
		display: flex;
		flex-direction: column;
		gap: var(--cortex-space-2, 0.5rem);
		min-width: 0;
		min-height: 0;
	}

	.pie-cortex-graph-panel {
		flex: 1 1 auto;
	}

	.pie-cortex-expression-list {
		display: flex;
		flex-direction: column;
		gap: var(--cortex-space-2, 0.5rem);
		min-width: 0;
	}

	.pie-cortex-expression-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		/*
		 * `start`, not `center`. The input cell holds the field *and* its caption, so
		 * centring aligned the chip on the pair rather than on the field — which is
		 * what made the old swatch look like a stray dash floating above the line.
		 */
		align-items: start;
		gap: var(--cortex-space-2, 0.5rem);
	}

	.pie-cortex-expression-input {
		min-width: 0;
	}

	.pie-cortex-series-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		/*
		 * 2.75rem, not the 20px a colour dot would suggest. This is the show/hide
		 * control now, and 2.5.8 sets 24px as the floor while the rest of this tool
		 * holds 44px — trading a 44px toggle down to 20px is exactly the regression a
		 * switch-access learner pays for.
		 */
		min-width: 2.75rem;
		min-height: 2.75rem;
		padding: 0;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: 50%;
		background: var(--pie-button-bg, var(--cortex-button-bg));
		cursor: pointer;
		transition: background-color 0.12s ease, opacity 0.12s ease;
	}

	.pie-cortex-series-chip__rule {
		display: block;
		width: 1.25rem;
		border-top-width: 3px;
		border-top-style: solid;
		border-top-color: currentcolor;
	}

	.pie-cortex-series-chip--dashed .pie-cortex-series-chip__rule {
		border-top-style: dashed;
	}

	.pie-cortex-series-chip--dotted .pie-cortex-series-chip__rule {
		border-top-style: dotted;
	}

	/*
	 * Hidden series: the chip empties out rather than only fading, so the state is
	 * carried by more than colour and survives a fixed-hue palette.
	 */
	.pie-cortex-series-chip--hidden {
		background: var(--pie-background-dark, var(--cortex-surface-raised));
	}

	.pie-cortex-series-chip--hidden .pie-cortex-series-chip__rule {
		border-top-style: dotted;
		opacity: 0.5;
	}

	.pie-cortex-series-chip--color-1 {
		color: var(--pie-calculator-series-1, var(--cortex-default-series-1, #075985));
	}

	.pie-cortex-series-chip--color-2 {
		color: var(--pie-calculator-series-2, var(--cortex-default-series-2, #9f1239));
	}

	.pie-cortex-series-chip--color-3 {
		color: var(--pie-calculator-series-3, var(--cortex-default-series-3, #166534));
	}

	.pie-cortex-series-chip--color-4 {
		color: var(--pie-calculator-series-4, var(--cortex-default-series-4, #6b21a8));
	}

	.pie-cortex-series-chip--color-5 {
		color: var(--pie-calculator-series-5, var(--cortex-default-series-5, #9a3412));
	}

	.pie-cortex-series-chip--color-6 {
		color: var(--pie-calculator-series-6, var(--cortex-default-series-6, #334155));
	}

	.pie-cortex-series-description {
		display: block;
		margin-top: 0.2rem;
		padding-inline: var(--cortex-tape-inset, 0.75rem);
		font-size: 0.75rem;
	}

	.pie-cortex-keypad__layers {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
	}

	.pie-cortex-layer-tab {
		min-height: 2.25rem;
		padding-inline: 0.6rem;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: 1rem;
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.12s ease;
	}

	.pie-cortex-layer-tab--active {
		border-color: var(--pie-primary, var(--cortex-primary));
		background: var(--pie-primary, var(--cortex-primary));
		color: var(--pie-white, var(--cortex-on-primary));
	}

	.pie-cortex-layer-tab:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-expression-actions,
	.pie-cortex-graph-controls,
	.pie-cortex-trace-controls {
		display: flex;
		align-items: center;
		gap: var(--cortex-space-1, 0.375rem);
		flex-wrap: wrap;
		min-width: 0;
	}

	.pie-cortex-icon-button,
	.pie-cortex-action-button {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.12s ease, border-color 0.12s ease;
	}

	.pie-cortex-icon-button {
		min-width: 2.75rem;
		padding: 0.45rem;
	}

	.pie-cortex-viewport-controls {
		display: flex;
		gap: 0.25rem;
		min-width: 0;
	}

	/*
	 * 2rem, where every other control in this package is 2.75rem.
	 *
	 * The shipped tool panel is 380x372 and the plot below has a height floor, so a
	 * second row of chrome pushes the calculator past the panel and the shell clips
	 * it. Six 2.75rem controls plus `Reset view` do not fit one row at 380px; at
	 * 2rem they do. That is 32px, comfortably past the 24px minimum target size of
	 * WCAG 2.5.8 at Level AA — 2.75rem is the Level AAA figure this package prefers
	 * where the space exists, and these are the one place it does not.
	 */
	.pie-cortex-viewport-button {
		min-width: 2rem;
		min-height: 2rem;
		padding: 0.2rem;
		font-size: 0.9375rem;
		line-height: 1;
	}

	.pie-cortex-icon-button:hover,
	.pie-cortex-action-button:hover,
	.pie-cortex-series-chip:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-icon-button:active,
	.pie-cortex-action-button:active {
		background: var(--pie-button-active-bg, var(--cortex-button-active-bg));
	}

	.pie-cortex-icon-button:focus-visible,
	.pie-cortex-action-button:focus-visible,
	.pie-cortex-layer-tab:focus-visible,
	.pie-cortex-series-chip:focus-visible,
	select:focus-visible {
		position: relative;
		z-index: 1;
		outline: 3px solid var(--pie-button-focus-outline, var(--cortex-focus-outline));
		outline-offset: 2px;
	}

	.pie-cortex-action-button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.pie-cortex-jsxgraph {
		width: 100%;
		/*
		 * Grows in both axes instead of being pinned to `min(26rem, 55vh)`, which was
		 * the largest single contributor to the 1032px of content this view used to
		 * stack into a 372px panel. The floor stays: a zero-height board renders no
		 * SVG, and `resizeBoard` guards the same case.
		 */
		flex: 1 1 auto;
		min-height: 14rem;
		border: 1px solid var(--pie-border, var(--cortex-border));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(
			--pie-calculator-surface-raised,
			var(--pie-background-dark, var(--cortex-surface-raised))
		);
		/*
		 * `pan-y`, not `none`. The board is taller than a short panel, and blocking
		 * every touch gesture over it meant a touch user could not scroll past the
		 * plot to reach the trace controls below it.
		 */
		touch-action: pan-y;
	}

	.pie-cortex-graph-status {
		font-size: 0.8125rem;
	}

	.pie-cortex-graph-readout {
		display: flex;
		flex-direction: column;
		/* Never squeezed: the plot yields height, the readout keeps its text. */
		flex: 0 0 auto;
		gap: var(--cortex-space-2, 0.5rem);
		min-width: 0;
		padding: var(--cortex-space-2, 0.5rem);
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(
			--pie-calculator-surface-raised,
			var(--pie-background-dark, var(--cortex-surface-raised))
		);
		font-size: 0.8125rem;
	}

	@container pie-cortex-calculator (min-width: 34rem) {
		.pie-cortex-graph-readout {
			flex-direction: row;
			flex-wrap: wrap;
		}

		.pie-cortex-graph-summary,
		.pie-cortex-trace {
			flex: 1 1 14rem;
			min-width: 0;
		}
	}

	.pie-cortex-graph-summary,
	.pie-cortex-trace {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.pie-cortex-trace__series {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.pie-cortex-trace__readout {
		font-variant-numeric: tabular-nums;
		/* Wraps rather than truncates: these are the coordinates being read. */
		overflow-wrap: anywhere;
	}

	select {
		min-height: 2.25rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	h3,
	p,
	ul {
		margin: 0;
	}

	ul {
		padding-inline-start: 1.1rem;
	}

	h3 {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.pie-cortex-sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (forced-colors: active) {
		.pie-cortex-icon-button,
		.pie-cortex-action-button,
		.pie-cortex-layer-tab,
		.pie-cortex-series-chip,
		select {
			border-color: ButtonBorder;
			background: ButtonFace;
			color: ButtonText;
			forced-color-adjust: none;
		}

		.pie-cortex-jsxgraph {
			border-color: CanvasText;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-cortex-icon-button,
		.pie-cortex-action-button,
		.pie-cortex-layer-tab,
		.pie-cortex-series-chip {
			transition: none;
		}
	}
</style>
