<script lang="ts">
	import {
		createCanvasColorMeasure,
		DAISY_SLOT_CSS_VARIABLES,
		DAISYUI_THEME_CATALOG,
		listPieColorSchemes,
		resolveDaisyPieVariables,
		resolvePieTheme,
		type ColorMeasure,
		type DaisySlot,
		type ThemeVariables,
	} from '@pie-players/pie-theme';
	import { onMount } from 'svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';

	/*
	 * The select-text hover state paints `--pie-blue-grey-300` behind a token and
	 * keeps the page's own ink on it. Two pairs have to hold: the fill against
	 * the page (3:1, WCAG 1.4.11) and the ink on the fill (4.5:1, WCAG 1.4.3).
	 * They multiply to 13.5:1 of ink on the page, so a palette under that cannot
	 * have both, and the fill stops at the text floor instead.
	 */
	const FILL_MINIMUM = 3;
	const TEXT_MINIMUM = 4.5;
	const BOTH_MINIMUM = FILL_MINIMUM * TEXT_MINIMUM;

	/** What `--pie-blue-grey-300` shipped as before the hover fill was corrected. */
	const PREVIOUS_FILL: Record<string, string> = {
		'light-base': '#c0c3cf',
		'dark-base': '#555555',
		'black-on-white': '#cccccc',
		'white-on-black': '#555555',
		'rose-on-green': '#99ddbb',
		'yellow-on-blue': '#333377',
		'black-on-rose': '#ffb3cc',
		'light-gray-on-dark-gray': '#555555',
		'grey-on-light-grey': '#d0d0d0',
		'purple-on-light-green': '#a6d0b2',
		'black-on-violet': '#c795d3',
		'yellow-on-navy': '#4a6aa8',
	};

	type Palette = {
		id: string;
		name: string;
		page: string;
		text: string;
		selected: string;
		outline: string;
		before: string;
		after: string;
	};

	type Measured = Palette & {
		textOnPage: number;
		fillBefore: number;
		fillAfter: number;
		textBefore: number;
		textAfter: number;
		limited: boolean;
		verdict: 'pass' | 'limited' | 'fail';
	};

	type Tab = 'schemes' | 'daisyui';

	let tab = $state<Tab>('schemes');
	let schemes = $state<Measured[]>([]);
	let daisy = $state<Measured[]>([]);
	let unmeasurable = $state(false);
	let probeHost = $state<HTMLDivElement>();

	function luminance(color: { r: number; g: number; b: number }): number {
		const channel = (value: number) => {
			const c = value / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
	}

	function ratio(measure: ColorMeasure, a: string, b: string): number {
		const x = measure(a);
		const y = measure(b);
		if (!x || !y) return Number.NaN;
		const lx = luminance(x);
		const ly = luminance(y);
		return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
	}

	function measurePalette(measure: ColorMeasure, palette: Palette): Measured {
		const textOnPage = ratio(measure, palette.text, palette.page);
		const fillAfter = ratio(measure, palette.after, palette.page);
		const textAfter = ratio(measure, palette.text, palette.after);
		const limited = textOnPage < BOTH_MINIMUM;
		const verdict =
			textAfter < TEXT_MINIMUM
				? 'fail'
				: fillAfter >= FILL_MINIMUM
					? 'pass'
					: limited
						? 'limited'
						: 'fail';
		return {
			...palette,
			textOnPage,
			fillBefore: ratio(measure, palette.before, palette.page),
			fillAfter,
			textBefore: ratio(measure, palette.text, palette.before),
			textAfter,
			limited,
			verdict,
		};
	}

	function fromResolution(
		id: string,
		name: string,
		variables: Readonly<ThemeVariables>,
	): Palette {
		return {
			id,
			name,
			page: variables['--pie-background'] ?? '#ffffff',
			text: variables['--pie-text'] ?? '#000000',
			selected: variables['--pie-blue-grey-100'] ?? '#ffffff',
			outline: variables['--pie-blue-grey-900'] ?? '#000000',
			before: PREVIOUS_FILL[id] ?? variables['--pie-blue-grey-300'] ?? '',
			after: variables['--pie-blue-grey-300'] ?? '',
		};
	}

	function builtInPalettes(): Palette[] {
		const palettes = [
			fromResolution('light-base', 'Light base theme', resolvePieTheme({ baseTheme: 'light' }).variables),
			fromResolution('dark-base', 'Dark base theme', resolvePieTheme({ baseTheme: 'dark' }).variables),
		];
		for (const scheme of listPieColorSchemes().schemes) {
			if (scheme.kind !== 'built-in') continue;
			palettes.push(
				fromResolution(
					scheme.id,
					scheme.name,
					resolvePieTheme({ requestedScheme: scheme.id }).variables,
				),
			);
		}
		return palettes;
	}

	/**
	 * Reads each DaisyUI theme's slots from a probe carrying its `data-theme`,
	 * then runs them through the same mapping `<pie-theme provider="daisyui">`
	 * uses, so "after" is exactly what a host on that theme gets.
	 */
	function daisyPalettes(host: HTMLElement, measure: ColorMeasure): Palette[] {
		const probe = document.createElement('div');
		host.append(probe);
		try {
			return DAISYUI_THEME_CATALOG.map((id) => {
				probe.setAttribute('data-theme', id);
				const style = getComputedStyle(probe);
				const read = (slot: DaisySlot) =>
					style.getPropertyValue(DAISY_SLOT_CSS_VARIABLES[slot]).trim() || undefined;
				const variables = resolveDaisyPieVariables({ read, measure });
				return {
					id,
					name: id,
					page: variables['--pie-background'] ?? '',
					text: variables['--pie-text'] ?? '',
					selected: variables['--pie-blue-grey-100'] ?? '',
					outline: variables['--pie-blue-grey-900'] ?? '',
					before: read('base200') ?? '',
					after: variables['--pie-blue-grey-300'] ?? '',
				};
			});
		} finally {
			probe.remove();
		}
	}

	onMount(() => {
		const measure = createCanvasColorMeasure();
		if (!measure || !probeHost) {
			unmeasurable = true;
			return;
		}
		schemes = builtInPalettes().map((palette) => measurePalette(measure, palette));
		daisy = daisyPalettes(probeHost, measure)
			.map((palette) => measurePalette(measure, palette))
			.sort((a, b) => a.fillAfter - b.fillAfter);
	});

	const rows = $derived(tab === 'schemes' ? schemes : daisy);
	const counts = $derived({
		pass: rows.filter((row) => row.verdict === 'pass').length,
		limited: rows.filter((row) => row.verdict === 'limited').length,
		fail: rows.filter((row) => row.verdict === 'fail').length,
	});

	const format = (value: number) => (Number.isFinite(value) ? `${value.toFixed(2)}:1` : 'n/a');

	const VERDICT_LABEL = {
		pass: 'Meets both',
		limited: 'Text-limited',
		fail: 'Fails',
	} as const;

	const sampleStyle = (row: Measured, fill: string) =>
		`--sample-page: ${row.page}; --sample-text: ${row.text}; --sample-fill: ${fill}; --sample-selected: ${row.selected}; --sample-outline: ${row.outline};`;
</script>

<svelte:head>
	<title>Select-text hover contrast - PIE Section Demos</title>
</svelte:head>

<SiteHeader title="PIE Section Demos" subtitle="Select-text hover contrast" />

<main class="container mx-auto max-w-7xl px-4 py-10">
	<header class="mb-8 max-w-3xl space-y-3">
		<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">pie-theme</p>
		<h1 class="text-4xl font-bold tracking-tight">Select-text hover contrast</h1>
		<p class="text-base-content/80">
			A hovered select-text token is painted with <code>--pie-blue-grey-300</code> and keeps the
			page's text colour. The fill needs {FILL_MINIMUM}:1 against the page to read as a state,
			and the text needs {TEXT_MINIMUM}:1 on the fill. Together they need
			{BOTH_MINIMUM}:1 of text on the page. Where a palette has less, no fill can meet both,
			so the fill stops where the text would drop under {TEXT_MINIMUM}:1.
		</p>
		<p class="text-sm text-base-content/70">
			Samples render hover and selected text in <code>--pie-text</code> and the selected outline in
			<code>--pie-blue-grey-900</code>, as pie-lib's select-text token does. A selected token
			stays selectable, so hovering it swaps its <code>--pie-blue-grey-100</code> fill for the
			hover fill. Point at any word in a sample to hover it; "the" is shown hovered, "sentence"
			selected, and "applies." selected and hovered.
		</p>
	</header>

	<div role="group" aria-label="Palette source" class="join mb-6">
		<button
			type="button"
			class="btn join-item btn-sm"
			class:btn-primary={tab === 'schemes'}
			aria-pressed={tab === 'schemes'}
			onclick={() => (tab = 'schemes')}
		>
			Built-in schemes
		</button>
		<button
			type="button"
			class="btn join-item btn-sm"
			class:btn-primary={tab === 'daisyui'}
			aria-pressed={tab === 'daisyui'}
			onclick={() => (tab = 'daisyui')}
		>
			DaisyUI themes
		</button>
	</div>

	{#if unmeasurable}
		<p role="alert" class="alert alert-warning">
			This browser has no canvas to measure colours with, so no ratios can be shown.
		</p>
	{:else}
		<p class="mb-6 text-sm" aria-live="polite">
			{rows.length} palettes: {counts.pass} meet both minimums, {counts.limited} are limited by
			their text contrast, {counts.fail} fail.
		</p>

		<ul class="pie-hover-grid" role="list">
			{#each rows as row (row.id)}
				<li class="card border border-base-300 bg-base-100 shadow-sm">
					<div class="card-body gap-4 p-5">
						<div class="flex items-start justify-between gap-3">
							<h2 class="card-title text-lg">{row.name}</h2>
							<span
								class="badge shrink-0"
								class:badge-success={row.verdict === 'pass'}
								class:badge-warning={row.verdict === 'limited'}
								class:badge-error={row.verdict === 'fail'}
							>
								{VERDICT_LABEL[row.verdict]}
							</span>
						</div>

						{#each [{ label: 'Before', fill: row.before }, { label: 'After', fill: row.after }] as sample (sample.label)}
							<div class="space-y-1">
								<p class="text-xs font-semibold uppercase tracking-wide text-base-content/70">
									{sample.label} <code class="break-all normal-case">{sample.fill}</code>
								</p>
								<p class="pie-hover-sample" style={sampleStyle(row, sample.fill)}>
									<span class="pie-hover-token">Select</span>
									<span class="pie-hover-token pie-hover-token--hovered">the</span>
									<span class="pie-hover-token pie-hover-token--selected">sentence</span>
									<span class="pie-hover-token">that</span>
									<span class="pie-hover-token pie-hover-token--selected pie-hover-token--hovered"
										>applies.</span
									>
								</p>
							</div>
						{/each}

						<table class="table table-xs">
							<caption class="sr-only">Contrast ratios for {row.name}</caption>
							<thead>
								<tr>
									<th scope="col">Pair</th>
									<th scope="col">Before</th>
									<th scope="col">After</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<th scope="row">Fill vs page ({FILL_MINIMUM}:1)</th>
									<td>{format(row.fillBefore)}</td>
									<td class:font-bold={row.fillAfter >= FILL_MINIMUM}>{format(row.fillAfter)}</td>
								</tr>
								<tr>
									<th scope="row">Text on fill ({TEXT_MINIMUM}:1)</th>
									<td>{format(row.textBefore)}</td>
									<td class:font-bold={row.textAfter >= TEXT_MINIMUM}>{format(row.textAfter)}</td>
								</tr>
								<tr>
									<th scope="row">Text on page</th>
									<td colspan="2">
										{format(row.textOnPage)}
										{#if row.limited}
											<span class="text-base-content/70">
												(under {BOTH_MINIMUM}:1, so both minimums can't be met)
											</span>
										{/if}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</li>
			{/each}
		</ul>
	{/if}

	<div bind:this={probeHost} class="pie-hover-probe" aria-hidden="true"></div>
</main>

<style>
	.pie-hover-grid {
		display: grid;
		gap: 1.25rem;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
	}

	.pie-hover-sample {
		margin: 0;
		padding: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--sample-text) 25%, transparent);
		border-radius: 0.5rem;
		background: var(--sample-page);
		color: var(--sample-text);
		font-size: 1rem;
		line-height: 2.2;
	}

	.pie-hover-token {
		padding: 0.1rem 0.15rem;
		border-radius: 4px;
		cursor: pointer;
	}

	.pie-hover-token.pie-hover-token--selected {
		border: 2px solid var(--sample-outline);
		background: var(--sample-selected);
		color: var(--sample-text);
	}

	/*
	 * After the selected rule so it wins on a selected token too: pie-lib keeps a
	 * selected token selectable, and its `:hover` rule outranks `.selectedToken`.
	 */
	.pie-hover-token:hover,
	.pie-hover-token.pie-hover-token--hovered {
		background: var(--sample-fill);
		color: var(--sample-text);
	}

	.pie-hover-probe {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
</style>
