<script lang="ts">
	import '@pie-players/pie-item-player';
	import '@pie-players/pie-theme';
	import { createCanvasColorMeasure, type ColorMeasure } from '@pie-players/pie-theme';
	import { onMount, tick } from 'svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import {
		applyDaisyTheme,
		DAISY_DEFAULT_THEMES,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
	} from '$lib/demo-runtime/demo-page-helpers';

	/*
	 * The player installs pie-theme's components.css once per document. Its
	 * generic rules — bare table/th/h1-h6 and framework-style names like `.table`
	 * — are confined to the containers the player mounts authored markup into,
	 * so a host's own DaisyUI `.table` keeps its look. Rules keyed on PIE, KDS or
	 * MathJax names stay document-wide, so content an element portals to <body>
	 * stays styled. The `.table` grid rules paint `--pie-text`.
	 */
	const GRID_MINIMUM = 3;

	const AUTHORED_MARKUP = `
<h3>Authored passage heading</h3>
<p class="numbered-paragraph"><span class="p-number">1</span>A numbered paragraph keeps its 36px indent.</p>

<p><strong>.table</strong>, two tbody groups (2px rule between them)</p>
<table class="table" data-check="player-table">
	<thead><tr><th data-check="player-head">Planet</th><th>Moons</th></tr></thead>
	<tbody><tr><td data-check="player-cell">Mars</td><td>2</td></tr><tr><td>Jupiter</td><td>95</td></tr></tbody>
	<tbody><tr><td>Saturn</td><td>146</td></tr></tbody>
</table>

<p><strong>.table.table-bordered</strong></p>
<table class="table table-bordered">
	<thead><tr><th>Element</th><th>Symbol</th></tr></thead>
	<tbody><tr><td>Hydrogen</td><td>H</td></tr><tr><td>Helium</td><td>He</td></tr></tbody>
</table>

<p><strong>.table.table-striped</strong></p>
<table class="table table-striped">
	<thead><tr><th>Day</th><th>High</th></tr></thead>
	<tbody><tr><td>Mon</td><td>21°</td></tr><tr><td>Tue</td><td>19°</td></tr><tr><td>Wed</td><td>23°</td></tr></tbody>
</table>

<p><strong>table.KdsTable01</strong></p>
<table class="KdsTable01">
	<tbody><tr><th>x</th><th>y</th></tr><tr><td>1</td><td>3</td></tr><tr><td>2</td><td>5</td></tr></tbody>
</table>

<div>Fractions: KDS
<table class="kds-fraction"><tbody><tr><td class="kds-numerator">3</td></tr><tr><td class="kds-denominator">4</td></tr></tbody></table>
and legacy
<table class="frac"><tbody><tr><td class="nu">1</td></tr><tr><td class="de">2</td></tr></tbody></table>
</div>
`;

	const itemConfig = { markup: AUTHORED_MARKUP, elements: {}, models: [] };

	type Check = { label: string; expected: string; actual: string; pass: boolean };

	let daisyTheme = $state(DEFAULT_DAISY_THEME);
	let checks = $state<Check[]>([]);
	let playerHost = $state<HTMLElement>();
	let hostTable = $state<HTMLTableElement>();
	let hostHeading = $state<HTMLHeadingElement>();
	let measure: ColorMeasure | null = null;
	let portal: HTMLDivElement | null = null;

	function luminance(color: { r: number; g: number; b: number }): number {
		const channel = (value: number) => {
			const c = value / 255;
			return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
	}

	function ratio(a: string, b: string): number {
		const x = measure?.(a);
		const y = measure?.(b);
		if (!x || !y) return Number.NaN;
		const lx = luminance(x);
		const ly = luminance(y);
		return (Math.max(lx, ly) + 0.05) / (Math.min(lx, ly) + 0.05);
	}

	const style = (element: Element | null | undefined) =>
		element ? getComputedStyle(element) : null;

	const rule = (s: CSSStyleDeclaration | null, side: 'Top' | 'Bottom') =>
		s ? `${s[`border${side}Width`]} ${s[`border${side}Style`]} ${s[`border${side}Color`]}` : 'missing';

	const hasNoRule = (s: CSSStyleDeclaration | null, side: 'Top' | 'Bottom') =>
		!!s && (s[`border${side}Style`] === 'none' || s[`border${side}Width`] === '0px');

	function runChecks() {
		const installed = document.querySelector('style[data-pie-content-styles]');
		const page =
			getComputedStyle(document.documentElement).getPropertyValue('--pie-background').trim() ||
			getComputedStyle(document.body).backgroundColor;

		const playerCell = style(playerHost?.querySelector('[data-check="player-cell"]'));
		const playerHead = style(playerHost?.querySelector('[data-check="player-head"]'));
		const hostCell = style(hostTable?.querySelector('td'));
		const hostH5 = style(hostHeading);
		const hostH5Parent = style(hostHeading?.parentElement);
		const portalNumerator = style(portal?.querySelector('.kds-numerator'));
		const portalTableCell = style(portal?.querySelector('.table td'));
		const portalMath = style(portal?.querySelector('.TEX-I'));

		const gridRatio = playerCell ? ratio(playerCell.borderTopColor, page) : Number.NaN;

		checks = [
			{
				label: 'Content stylesheet installed by the player',
				expected: 'one style[data-pie-content-styles] element',
				actual: installed ? `installed by ${installed.getAttribute('data-pie-content-styles')}` : 'none',
				pass: !!installed,
			},
			{
				label: 'Player .table cell rule paints the text colour',
				expected: '1px solid, same colour as the cell text',
				actual: rule(playerCell, 'Top'),
				pass:
					!!playerCell &&
					playerCell.borderTopStyle === 'solid' &&
					playerCell.borderTopColor === playerCell.color,
			},
			{
				label: `Player grid rule against the page (SC 1.4.11, ${GRID_MINIMUM}:1)`,
				expected: `≥ ${GRID_MINIMUM}:1`,
				actual: Number.isFinite(gridRatio) ? `${gridRatio.toFixed(2)}:1 on ${page}` : 'not measurable',
				pass: gridRatio >= GRID_MINIMUM,
			},
			{
				label: 'Player .table thead th rule',
				expected: '2px solid',
				actual: rule(playerHead, 'Bottom'),
				pass: !!playerHead && playerHead.borderBottomStyle === 'solid' && playerHead.borderBottomWidth === '2px',
			},
			{
				label: "Host DaisyUI .table cell keeps DaisyUI's look",
				expected: 'no content-stylesheet top rule',
				actual: rule(hostCell, 'Top'),
				pass: hasNoRule(hostCell, 'Top'),
			},
			{
				label: 'Host h5 is not resized by the content heading rule',
				expected: hostH5Parent ? `font-size ${hostH5Parent.fontSize} (inherited)` : 'inherited',
				actual: hostH5 ? `font-size ${hostH5.fontSize}` : 'missing',
				pass: !!hostH5 && !!hostH5Parent && hostH5.fontSize === hostH5Parent.fontSize,
			},
			{
				label: 'Portaled KDS fraction keeps its bar',
				expected: '1px solid bottom rule',
				actual: rule(portalNumerator, 'Bottom'),
				pass: !!portalNumerator && portalNumerator.borderBottomStyle === 'solid',
			},
			{
				label: 'Portaled MathJax glyph fix still applies',
				expected: 'font-family starts with MJXZERO',
				actual: portalMath?.fontFamily ?? 'missing',
				pass: !!portalMath && portalMath.fontFamily.startsWith('MJXZERO'),
			},
			{
				label: 'Portaled .table is outside every container, so not gridded',
				expected: 'no content-stylesheet top rule',
				actual: rule(portalTableCell, 'Top'),
				pass: hasNoRule(portalTableCell, 'Top'),
			},
		];
	}

	/** Re-measure after the theme's inline --pie-* values have landed. */
	function scheduleChecks() {
		requestAnimationFrame(() => requestAnimationFrame(runChecks));
	}

	function selectTheme(theme: string) {
		applyDaisyTheme(theme, (next) => (daisyTheme = next));
		scheduleChecks();
	}

	/*
	 * Stands in for an MUI menu, popover or modal: elements render those into
	 * <body>, outside every player container.
	 */
	function mountPortal(): HTMLDivElement {
		const node = document.createElement('div');
		node.className = 'pie-content-styles-portal';
		node.setAttribute('role', 'region');
		node.setAttribute('aria-label', 'Simulated portal attached to body');
		node.innerHTML = `
			<p class="pie-content-styles-portal__title">Simulated portal (a direct child of &lt;body&gt;)</p>
			<div>KDS fraction:
				<table class="kds-fraction"><tbody><tr><td class="kds-numerator">5</td></tr><tr><td class="kds-denominator">8</td></tr></tbody></table>
				&nbsp;MathJax-classed glyph: <span class="TEX-I">x</span>
			</div>
			<table class="table"><tbody><tr><td>.table outside the player</td><td>stays unruled</td></tr></tbody></table>`;
		document.body.append(node);
		return node;
	}

	onMount(() => {
		daisyTheme = window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME;
		measure = createCanvasColorMeasure();
		portal = mountPortal();

		// The item renders asynchronously; measure once its cells exist.
		const observer = new MutationObserver(() => {
			if (playerHost?.querySelector('[data-check="player-cell"]')) scheduleChecks();
		});
		if (playerHost) observer.observe(playerHost, { childList: true, subtree: true });
		void tick().then(scheduleChecks);

		return () => {
			observer.disconnect();
			portal?.remove();
			portal = null;
		};
	});

	const passed = $derived(checks.filter((check) => check.pass).length);
</script>

<svelte:head>
	<title>Content stylesheet confinement - PIE Section Demos</title>
</svelte:head>

<SiteHeader title="PIE Section Demos" subtitle="Content stylesheet confinement" />

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme={daisyTheme}>
	<main class="container mx-auto max-w-6xl px-4 py-10">
		<header class="mb-8 max-w-3xl space-y-3">
			<p class="text-xs font-bold uppercase tracking-[0.08em] text-primary">pie-theme · components.css</p>
			<h1 class="text-4xl font-bold tracking-tight">Content stylesheet confinement</h1>
			<p class="text-base-content/80">
				The item player installs pie-theme's content stylesheet for the whole document. Its generic
				rules — bare <code>table</code>, <code>th</code>, <code>h1</code>–<code>h6</code> and
				framework-style names such as <code>.table</code> — now apply only inside the containers the
				player mounts authored markup into. The host's own DaisyUI tables below should keep
				DaisyUI's look, while the authored tables get grid rules in the text colour.
			</p>
			<p class="text-sm text-base-content/70">
				Rules keyed on PIE, KDS or MathJax names stay document-wide, so the simulated portal at the
				bottom of the page, which sits outside every player, keeps its KDS fraction bar and glyph
				font.
			</p>
		</header>

		<div class="mb-8 flex flex-wrap items-end gap-4">
			<label class="form-control w-60">
				<span class="label-text mb-1 text-sm font-semibold">DaisyUI theme</span>
				<select
					class="select select-bordered select-sm"
					value={daisyTheme}
					onchange={(event) => selectTheme(event.currentTarget.value)}
				>
					{#each DAISY_DEFAULT_THEMES as theme (theme)}
						<option value={theme}>{theme}</option>
					{/each}
				</select>
			</label>
			<button type="button" class="btn btn-sm" onclick={runChecks}>Re-run checks</button>
		</div>

		<section class="mb-10" aria-labelledby="checks-heading">
			<h2 id="checks-heading" class="mb-2 text-2xl font-bold">Checks</h2>
			<p class="mb-3 text-sm" aria-live="polite">
				{#if checks.length}
					{passed} of {checks.length} pass on <code>{daisyTheme}</code>.
				{:else}
					Waiting for the item to render…
				{/if}
			</p>
			<div class="overflow-x-auto">
				<table class="table table-sm">
					<thead>
						<tr>
							<th scope="col">Check</th>
							<th scope="col">Expected</th>
							<th scope="col">Measured</th>
							<th scope="col">Result</th>
						</tr>
					</thead>
					<tbody>
						{#each checks as check (check.label)}
							<tr>
								<th scope="row" class="font-normal">{check.label}</th>
								<td>{check.expected}</td>
								<td><code class="break-all">{check.actual}</code></td>
								<td>
									<span class="badge" class:badge-success={check.pass} class:badge-error={!check.pass}>
										{check.pass ? 'Pass' : 'Fail'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<div class="grid items-start gap-6 lg:grid-cols-2">
			<section class="card border border-base-300 bg-base-100 shadow-sm" aria-labelledby="host-heading">
				<div class="card-body">
					<h2 id="host-heading" class="card-title">Host UI, outside any player</h2>
					<p class="text-sm text-base-content/70">
						DaisyUI's own <code>.table</code>, as in a host's admin pages. It should look like
						DaisyUI, with no black row rules.
					</p>
					<table class="table table-zebra" bind:this={hostTable}>
						<thead><tr><th>Version</th><th>Status</th></tr></thead>
						<tbody>
							<tr><td>1.4.0</td><td>Sanctioned</td></tr>
							<tr><td>1.3.2</td><td>Retired</td></tr>
							<tr><td>1.3.1</td><td>Retired</td></tr>
						</tbody>
					</table>
					<div>
						<h5 bind:this={hostHeading} class="font-semibold">A host h5 heading</h5>
						<p class="text-sm">Should stay at the surrounding text size.</p>
					</div>
				</div>
			</section>

			<section class="card border border-base-300 bg-base-100 shadow-sm" aria-labelledby="player-heading">
				<div class="card-body">
					<h2 id="player-heading" class="card-title">Authored content in &lt;pie-item-player&gt;</h2>
					<p class="text-sm text-base-content/70">
						Grid rules should paint the text colour on every theme.
					</p>
					<div bind:this={playerHost}>
						<pie-item-player config={itemConfig}></pie-item-player>
					</div>
				</div>
			</section>
		</div>
	</main>
</pie-theme>

<style>
	:global(.pie-content-styles-portal) {
		max-width: 72rem;
		margin: 0 auto 2.5rem;
		padding: 1rem 1.25rem;
		border: 2px dashed var(--color-warning, #b45309);
		border-radius: 0.75rem;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #111);
	}

	:global(.pie-content-styles-portal__title) {
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
</style>
