<script lang="ts">
	import { convertLatexToMarkup, type MathfieldElement } from 'mathlive';
	import { onMount, untrack } from 'svelte';
	import GraphView from './GraphView.svelte';
	import Keypad from './Keypad.svelte';
	import MathFieldInput from './MathFieldInput.svelte';
	import type { CortexCalculatorController } from './calculator-controller.js';
	import { keypadLayers, type KeypadKey } from './keypad-layouts.js';

	let { controller }: { controller: CortexCalculatorController } = $props();
	let snapshot = $state(untrack(() => controller.getSnapshot()));
	const i18n = $derived(controller.settings.localization);

	let field = $state<MathfieldElement | null>(null);
	let display = $state<HTMLDivElement | null>(null);
	/**
	 * The single polite announcement channel, last event wins.
	 *
	 * It exists because MathLive's own announce hook covers move, delete,
	 * replacement, line and plonk — never insert — and `executeCommand` produces no
	 * keystroke for AT to echo, so a keypad press would otherwise be silent. Results,
	 * angle-mode changes and key presses share one region rather than competing: two
	 * live regions updating together is how an announcement gets dropped, and a fixed
	 * priority would have left every keypress unspoken while an answer stood.
	 */
	let announcement = $state('');

	const isGraphing = $derived(controller.settings.type === 'graphing');
	// Basic has no trigonometry — `validateSymbol` rejects even the constants — so an
	// angle unit is a control over nothing there.
	const showsAngleMode = $derived(controller.settings.type !== 'basic');
	const layers = $derived(keypadLayers(controller.settings, i18n));
	// Empty means "the first layer". The tabs render on the keypad's plane but the
	// selection is owned here, because the keypad takes them as a snippet.
	let selectedLayerId = $state('');
	const activeLayerId = $derived(
		layers.some((layer) => layer.id === selectedLayerId)
			? selectedLayerId
			: (layers[0]?.id ?? ''),
	);

	const typeLabel = $derived(
		controller.settings.type === 'basic'
			? i18n.t('basicCalculator')
			: controller.settings.type === 'scientific'
				? i18n.t('scientificCalculator')
				: i18n.t('graphingCalculator'),
	);

	// Newest last, so the tape reads downward like a paper roll. Reversed in the
	// template rather than with `column-reverse`, which would leave DOM order
	// contradicting visual order.
	const tapeEntries = $derived([...snapshot.history].reverse());

	async function evaluate(): Promise<void> {
		try {
			await controller.evaluate();
		} catch {
			// The controller publishes the accessible error state.
		}
	}

	function insertKey(key: KeypadKey): void {
		if (!field) return;
		// One writer: `executeCommand` goes through MathLive's edit pipeline, which
		// fires `input`, which `MathFieldInput` already forwards to the controller.
		// Calling `controller.setValue` here as well would fight the value-sync guard,
		// because MathLive normalises what it is handed and the guard never settles.
		field.executeCommand(['insert', key.latex]);
		field.focus();
		announcement = i18n.t(key.nameKey, key.nameValues ?? {});
	}

	function backspace(): void {
		// Not `inputLatex.slice(0, -1)`: that string-slices LaTeX, turning `\pi` into
		// `\p` and `\sqrt{2}` into `\sqrt{2`. MathLive knows where a token ends.
		field?.executeCommand('deleteBackward');
		field?.focus();
		controller.requestFocus();
	}

	function setAngleMode(mode: 'degree' | 'radian'): void {
		if (mode === snapshot.angleMode) return;
		controller.setAngleMode(mode);
		announcement = i18n.t('angleModeChanged', {
			mode: i18n.t(mode === 'degree' ? 'degrees' : 'radians'),
		});
	}

	onMount(() =>
		controller.subscribe((value) => {
			// A new result, or the start of one, is the newest thing to say.
			if (value.busy && !snapshot.busy) announcement = i18n.t('calculating');
			else if (value.result && value.result !== snapshot.result) {
				announcement = i18n.t('result', { result: i18n.formatResult(value.result) });
			}
			snapshot = value;
		}),
	);

	/**
	 * How much room the panel is giving this calculator, as one of three tiers.
	 *
	 * A tool panel is resizable, so the height available is a runtime fact rather
	 * than a design constant, and every fixed size below it — key targets, the
	 * result's type size, the board's floor — has to answer to it. The tiers are
	 * measured from what each layout needs with full-size keys: basic wants 398px of
	 * content and scientific 385px, so `comfortable` starts at 400.
	 *
	 * A `ResizeObserver` rather than a CSS container query on `block-size`, which
	 * would need `container-type: size` on this element: that carries
	 * `contain: layout`, which makes this element the containing block for every
	 * fixed-position descendant — MathLive's own popovers among them — and turns a
	 * type-size decision into a change in where an overlay lands.
	 */
	let density = $state<'comfortable' | 'compact' | 'tight'>('comfortable');

	function densityFor(height: number): 'comfortable' | 'compact' | 'tight' {
		if (height >= 400) return 'comfortable';
		return height >= 320 ? 'compact' : 'tight';
	}

	let root = $state<HTMLElement | null>(null);

	$effect(() => {
		const element = root;
		if (!element || typeof ResizeObserver === 'undefined') return;
		let frame = 0;
		/*
		 * `clientHeight`, not the entry's `contentRect`: a tier changes this element's
		 * padding, and a content box that moves with the tier is a feedback loop that
		 * oscillates around a threshold. The padding box does not move with it.
		 *
		 * The write is deferred to the next frame because a tier changes layout, and
		 * changing layout while resize notifications are being delivered is what
		 * produces "ResizeObserver loop completed with undelivered notifications".
		 */
		const observer = new ResizeObserver(() => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				const next = densityFor(element.clientHeight);
				if (next !== density) density = next;
			});
		});
		observer.observe(element);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			observer.disconnect();
		};
	});

	// Keep the newest tape row in view without running on every keystroke: each
	// publish is a new snapshot, so this reads only the length it cares about.
	$effect(() => {
		void tapeEntries.length;
		void snapshot.result;
		untrack(() => {
			if (display) display.scrollTop = display.scrollHeight;
		});
	});
</script>

<section
	class="pie-cortex-calculator"
	bind:this={root}
	data-pie-density={density}
	data-pie-calculator-type={controller.settings.type}
	data-pie-theme={controller.settings.theme}
	lang={i18n.locale}
	dir={i18n.direction}
	aria-label={typeLabel}
>
	<!--
		Not drawn. The tool shell's header already carries this exact string, and a
		second copy of it in a row of its own cost 46px of a 500px panel — a row
		neither reference calculator spends. The heading stays in the tree because the
		region's entry in the document outline comes from it.
	-->
	<h2 class="pie-cortex-sr-only">{typeLabel}</h2>

	<!--
		Declared once and placed per layout: inside the display for the keypad
		calculators, where the screen has vertical slack that a strip of its own does
		not, and above the plot for the graphing one, whose panel is wide enough to
		carry a row.
	-->
	{#snippet angleModeControl()}
		<div
			class="pie-cortex-angle-mode"
			role="radiogroup"
			aria-label={i18n.t('angleMode')}
		>
			{#each [{ mode: 'degree', short: 'angleModeDegreesShort', long: 'degrees' }, { mode: 'radian', short: 'angleModeRadiansShort', long: 'radians' }] as const as option (option.mode)}
				<button
					type="button"
					role="radio"
					class="pie-cortex-angle-mode__segment"
					class:pie-cortex-angle-mode__segment--active={snapshot.angleMode === option.mode}
					aria-checked={snapshot.angleMode === option.mode}
					aria-label={i18n.t(option.long)}
					tabindex={snapshot.angleMode === option.mode ? 0 : -1}
					onkeydown={(event) => {
						if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
						event.preventDefault();
						setAngleMode(snapshot.angleMode === 'degree' ? 'radian' : 'degree');
					}}
					onclick={() => setAngleMode(option.mode)}
				>
					<span aria-hidden="true">{i18n.t(option.short)}</span>
					{#if snapshot.angleMode === option.mode}
						<!-- Selection is not carried by fill alone: under the fixed-hue colour
						     schemes there are effectively two colours. -->
						<span class="pie-cortex-angle-mode__mark" aria-hidden="true">✓</span>
					{/if}
				</button>
			{/each}
		</div>
	{/snippet}

	{#if isGraphing}
		<GraphView {controller} {snapshot} {layers} angleMode={angleModeControl} />
	{:else}
		<!--
			One pane, bordered and filled like the screen it is. The mathfield used to
			be the only bordered thing in a transparent column, so the slack the display
			takes read as a hole above the input rather than as the space a tape fills —
			which is how both reference calculators draw it.
		-->
		<div class="pie-cortex-display">
			{#if showsAngleMode}
				<!-- Outside the scroller: pinned to the pane, not scrolled away by the tape. -->
				<div class="pie-cortex-display__head">{@render angleModeControl()}</div>
			{/if}

			<div class="pie-cortex-display__scroll" bind:this={display}>
				{#if controller.settings.historyLimit > 0 && tapeEntries.length > 0}
					<div
						class="pie-cortex-tape"
						role="group"
						aria-label={i18n.t('calculationHistory')}
					>
						{#each tapeEntries as entry (`${entry.timestamp}:${entry.expression}`)}
							<button
								type="button"
								class="pie-cortex-tape__row"
								onclick={() => {
									controller.setValue(entry.expression);
									controller.requestFocus();
								}}
							>
								<!--
									Typeset, not printed. The tape stores LaTeX, and rendering it raw put
									`\sin(30)` on screen literally. LTR-isolated because LaTeX is
									left-to-right content inside a UI that may be RTL, where an
									un-isolated `2+2 = 4` bidi-reorders.
								-->
								<span class="pie-cortex-tape__expression" dir="ltr"
									>{@html convertLatexToMarkup(entry.expression)}</span
								>
								<span class="pie-cortex-tape__result" dir="ltr">{i18n.formatResult(entry.result)}</span>
							</button>
						{/each}
						<button
							type="button"
							class="pie-cortex-tape__clear"
							onclick={() => controller.clearHistory()}
						>{i18n.t('clearHistory')}</button>
					</div>
				{/if}

				<div class="pie-cortex-active-line">
					<MathFieldInput
						value={snapshot.inputLatex}
						label={i18n.t('expressionLabel', { calculator: typeLabel })}
						localization={i18n}
						restrictedMode={controller.settings.restrictedMode}
						focusRequest={snapshot.focusRequest}
						onInput={(value) => controller.setValue(value)}
						onCommit={evaluate}
						onFieldReady={(instance) => (field = instance)}
					/>
					<!--
						The visible display shows the bare value — a calculator's answer does not
						caption itself — while the announcement keeps the localized
						`result` framing. They are split rather than shared because a bare
						number announced on its own carries no context, and only the hidden node
						is live so nothing is announced twice.
					-->
					<p class="pie-cortex-result" aria-hidden="true">
						{#if snapshot.result}{i18n.formatResult(snapshot.result)}{/if}
					</p>
				</div>

				<!-- Always mounted, so the alert exists before it has text to carry. A live
				     region created at the moment its content appears often fails to announce. -->
				<p class="pie-cortex-error" role="alert" hidden={!snapshot.errorCode}>
					{#if snapshot.errorCode}{i18n.errorMessage(snapshot.errorCode)}{/if}
				</p>
			</div>
		</div>

		{#snippet editControls()}
		<div class="pie-cortex-calculator__edits">
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
			<!--
				Glyph faces with text accessible names, the way both reference calculators
				draw them: `Backspace` and `Clear` as two wide labelled buttons were the
				widest thing on the plane and read as a form's controls sitting next to a
				keypad. 2.5.3 does not apply — there is no visible label text for the name
				to have to contain — and `title` carries the same string, so a pointer user
				can find out what the glyph does without reading the accessibility tree.
			-->
			<button
				type="button"
				class="pie-cortex-action-button pie-cortex-icon-button pie-cortex-calculator__edits-end"
				aria-label={i18n.t('backspace')}
				title={i18n.t('backspace')}
				onclick={backspace}
			><span aria-hidden="true">⌫</span></button>
			<button
				type="button"
				class="pie-cortex-action-button pie-cortex-icon-button"
				aria-label={i18n.t('clear')}
				title={i18n.t('clear')}
				onclick={() => controller.clear()}
			><span aria-hidden="true">✕</span></button>
		</div>
		{/snippet}

		<Keypad
			{layers}
			{activeLayerId}
			bleed={true}
			head={editControls}
			localization={i18n}
			onInsert={insertKey}
			onCommit={evaluate}
		/>
	{/if}

	<p class="pie-cortex-sr-only" role="status" aria-live="polite" aria-atomic="true">
		{announcement}
	</p>
</section>

<style>
	.pie-cortex-calculator {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		/*
		 * `min-height: 0` on a flex column is what lets the display shrink so the
		 * keypad stays inside the panel. A grid with `auto 1fr auto` will not do:
		 * a grid row's automatic minimum is min-content, so the tape would refuse to
		 * shrink and push the keypad out of a box whose overflow the tool shell clips.
		 */
		gap: var(--cortex-space-2, 0.5rem);
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		padding: var(--cortex-space-3, 0.75rem);
		/*
		 * The size the layout inside this element responds to is *this element's*
		 * width, not the window's. The shipped tool panel is 380px wide inside a
		 * viewport that is typically 1280px, so the viewport media queries this
		 * package used before never fired in production: the graphing grid stayed at
		 * its 544px floor inside a 333px box and its right-hand 229px — most of the
		 * plot — was clipped by the shell's `overflow-x: hidden`. Everything
		 * size-dependent below is a container query for that reason.
		 */
		container-type: inline-size;
		container-name: pie-cortex-calculator;
		/*
		 * The floor, not the layout. Below the tiers' smallest metrics the content
		 * genuinely does not fit, and this element scrolls it. It cannot be left to
		 * the tool shell: the wrapper pins this element to `height: 100% !important`
		 * inside an `overflow: hidden` box, so the shell's own `overflow-y: auto`
		 * never sees anything to scroll and the surplus was clipped instead.
		 */
		overflow-y: auto;
		background: var(
			--pie-calculator-surface,
			var(--pie-white, var(--cortex-surface))
		);
		color: var(--pie-text, var(--cortex-text));
		font-family: var(--pie-font-family, system-ui, sans-serif);
	}

	/*
	 * Package defaults live on `--cortex-*` names and are consumed as a canonical
	 * `--pie-` token with the `--cortex-` one as its fallback. Declaring `--pie-*`
	 * on this element, as this
	 * file used to, overrides whatever an ancestor set — which silently defeated the
	 * ten `[data-color-scheme]` PNP palettes `@pie-players/pie-theme` publishes, for
	 * every token except the six series colours that already used this pattern.
	 *
	 * Surfaces deliberately do *not* consume `--pie-background`: the canonical light
	 * theme publishes it as `rgba(255, 255, 255, 0)`, and a transparent calculator
	 * over the tool wrapper's own fill loses every contrast guarantee the package
	 * makes. `--pie-white` and `--pie-background-dark` are opaque in the base themes
	 * and in all ten schemes, so those carry the card and the recessed plane.
	 */
	/*
	 * `auto` is listed alongside `light` because the dark values below live in a
	 * `prefers-color-scheme` block: without it an `auto` calculator on a light OS
	 * matched no palette rule at all and every `--cortex-*` fallback resolved to
	 * nothing, which silently erased the key and field borders.
	 */
	.pie-cortex-calculator[data-pie-theme='light'],
	.pie-cortex-calculator[data-pie-theme='auto'] {
		color-scheme: light;
		--cortex-surface: #fff;
		--cortex-surface-raised: #ecedf1;
		--cortex-text: #0f172a;
		--cortex-border: #64748b;
		/* Key and field boundaries: 3.20:1 on the recessed plane, clearing 1.4.11. */
		--cortex-border-gray: #7e8494;
		--cortex-button-bg: #fff;
		--cortex-button-color: #0f172a;
		--cortex-button-hover-bg: #f3f5f7;
		--cortex-button-active-bg: #e4e7ec;
		--cortex-primary: #3f51b5;
		--cortex-on-primary: #fff;
		--cortex-focus-outline: #2563eb;
		--cortex-incorrect: #b91c1c;
		--cortex-incorrect-secondary: #fef2f2;
		--cortex-content-emphasis: #7f1d1d;
		--cortex-grid: #c0c3cf;
		--cortex-default-series-1: #075985;
		--cortex-default-series-2: #9f1239;
		--cortex-default-series-3: #166534;
		--cortex-default-series-4: #6b21a8;
		--cortex-default-series-5: #9a3412;
		--cortex-default-series-6: #334155;
	}

	.pie-cortex-calculator[data-pie-theme='dark'] {
		color-scheme: dark;
		--cortex-surface: #111827;
		--cortex-surface-raised: #1f2937;
		--cortex-text: #f8fafc;
		--cortex-border: #cbd5e1;
		/* 7.49:1 on the recessed plane. `--pie-button-border` would be 2.64:1 here. */
		--cortex-border-gray: #aaa;
		--cortex-button-bg: #1f2937;
		--cortex-button-color: #f8fafc;
		--cortex-button-hover-bg: #374151;
		--cortex-button-active-bg: #4b5563;
		--cortex-primary: #ffff00;
		--cortex-on-primary: #000;
		--cortex-focus-outline: #93c5fd;
		--cortex-incorrect: #ff6666;
		--cortex-incorrect-secondary: #330000;
		--cortex-content-emphasis: #ff9999;
		--cortex-grid: #555;
		--cortex-default-series-1: #7dd3fc;
		--cortex-default-series-2: #fda4af;
		--cortex-default-series-3: #86efac;
		--cortex-default-series-4: #d8b4fe;
		--cortex-default-series-5: #fdba74;
		--cortex-default-series-6: #cbd5e1;
	}

	@media (prefers-color-scheme: dark) {
		.pie-cortex-calculator[data-pie-theme='auto'] {
			color-scheme: dark;
			--cortex-surface: #111827;
			--cortex-surface-raised: #1f2937;
			--cortex-text: #f8fafc;
			--cortex-border: #cbd5e1;
			--cortex-border-gray: #aaa;
			--cortex-button-bg: #1f2937;
			--cortex-button-color: #f8fafc;
			--cortex-button-hover-bg: #374151;
			--cortex-button-active-bg: #4b5563;
			--cortex-primary: #ffff00;
			--cortex-on-primary: #000;
			--cortex-focus-outline: #93c5fd;
			--cortex-incorrect: #ff6666;
			--cortex-incorrect-secondary: #330000;
			--cortex-content-emphasis: #ff9999;
			--cortex-grid: #555;
			--cortex-default-series-1: #7dd3fc;
			--cortex-default-series-2: #fda4af;
			--cortex-default-series-3: #86efac;
			--cortex-default-series-4: #d8b4fe;
			--cortex-default-series-5: #fdba74;
			--cortex-default-series-6: #cbd5e1;
		}
	}

	.pie-cortex-calculator[data-pie-theme='light'],
	.pie-cortex-calculator[data-pie-theme='dark'],
	.pie-cortex-calculator[data-pie-theme='auto'] {
		/* One 4px step, so every gap in the tool is a multiple of the same unit. */
		--cortex-space-1: 0.375rem;
		--cortex-space-2: 0.5rem;
		--cortex-space-3: 0.75rem;
		--cortex-radius-key: 0.25rem;
		--cortex-radius-surface: 0.5rem;
		--cortex-tape-inset: 0.75rem;
	}

	/*
	 * Every fixed size in this tool, in one place, because a tool panel is resizable
	 * and the height available is therefore a runtime fact. `data-pie-density` is
	 * measured in script from this element's own box — see `densityFor` — rather
	 * than from the viewport: a 406px panel inside a 900px window is the ordinary
	 * case, and the `@media (max-height: 30rem)` rule this replaces never fired
	 * there. The child components read these tokens, so a tier is one declaration
	 * rather than an override per component.
	 */
	.pie-cortex-calculator {
		--cortex-key-min-height: 2.75rem;
		--cortex-control-min-height: 2.75rem;
		--cortex-display-min-height: 4rem;
		--cortex-result-font-size: 1.75rem;
		--cortex-plot-min-height: 14rem;
	}

	/*
	 * Below what full-size keys fit, keys give up height before the keypad gives up
	 * rows: a row scrolled out of the panel costs a pointer or switch-access learner
	 * the key entirely, where a shorter one still hits it. 2.5.8 sets the floor at
	 * 24px and the smallest tier here is 28px; the 44px of 2.5.5 holds at every size
	 * the shipped panels open at, which is what the tiers are measured against.
	 */
	.pie-cortex-calculator[data-pie-density='compact'] {
		--cortex-space-2: 0.375rem;
		--cortex-space-3: 0.5rem;
		--cortex-key-min-height: 2.25rem;
		--cortex-control-min-height: 2.25rem;
		--cortex-display-min-height: 2.75rem;
		--cortex-result-font-size: 1.375rem;
		--cortex-plot-min-height: 10rem;
	}

	.pie-cortex-calculator[data-pie-density='tight'] {
		--cortex-space-1: 0.25rem;
		--cortex-space-2: 0.25rem;
		--cortex-space-3: 0.375rem;
		--cortex-key-min-height: 1.75rem;
		--cortex-control-min-height: 2rem;
		--cortex-display-min-height: 2rem;
		--cortex-result-font-size: 1.125rem;
		--cortex-plot-min-height: 8rem;
	}

	/*
	 * The display is the only row that yields. A flex item shrunk below its content
	 * paints outside its box rather than clipping it, so a shrinkable keypad overlaps
	 * whatever follows — which is how keypad rows ended up drawn on top of the graph
	 * controls in a short panel.
	 */
	.pie-cortex-calculator__edits {
		flex: 0 0 auto;
	}

	h2,
	p {
		margin: 0;
	}

	.pie-cortex-angle-mode {
		/*
		 * The one control that is genuinely edge-anchored gets there on its own, so
		 * `space-between` is not needed on the row. That declaration used to be shared
		 * with the button row, where it scattered three buttons across the full width.
		 */
		margin-inline-start: auto;
		display: flex;
		min-width: 0;
		border: 1px solid var(--pie-primary, var(--cortex-primary));
		border-radius: var(--cortex-radius-key, 0.25rem);
		overflow: hidden;
	}

	.pie-cortex-angle-mode__segment {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		min-height: 2.25rem;
		padding: 0.25rem 0.55rem;
		border: none;
		border-inline-end: 1px solid var(--pie-primary, var(--cortex-primary));
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.12s ease, color 0.12s ease;
	}

	.pie-cortex-angle-mode__segment:last-child {
		border-inline-end: none;
	}

	.pie-cortex-angle-mode__segment:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-angle-mode__segment--active {
		background: var(--pie-primary, var(--cortex-primary));
		color: var(--pie-white, var(--cortex-on-primary));
	}

	.pie-cortex-angle-mode__mark {
		font-size: 0.6875rem;
	}

	/*
	 * No card, no margins: the screen runs to the panel's edges and the keypad's
	 * plane runs to the other three, so the panel *is* the instrument. This is the
	 * arrangement both reference calculators use, and the inset version of it spent
	 * the panel's perimeter on white gutters — a 380px panel has none to spare. The
	 * insets that remain are the ones inside each surface: `--cortex-tape-inset` for
	 * the screen's rows and the keypad's own inline padding, which are the same
	 * value, so the mathfield's left edge and the first key column's line up.
	 *
	 * Graphing keeps its padding: there the two columns are the card's content, not
	 * one stacked instrument.
	 */
	.pie-cortex-calculator:not([data-pie-calculator-type='graphing']) {
		gap: 0;
		padding: 0;
	}

	.pie-cortex-display {
		display: flex;
		flex-direction: column;
		/* Takes the slack, and gives it all back when the panel is short. */
		flex: 1 1 auto;
		min-height: var(--cortex-display-min-height, 4rem);
		min-width: 0;
		padding-block: var(--cortex-space-2, 0.5rem);
		/*
		 * The screen: the lit surface the answer sits on, one step lighter than the
		 * keypad's plane below it. Before it had a surface at all, the slack this row
		 * absorbs was bare card around a lone bordered mathfield, which is what made a
		 * 380x500 panel look like it had a hole in it.
		 */
		background: var(--pie-calculator-surface, var(--pie-white, var(--cortex-surface)));
	}

	/*
	 * Pinned above the scroller, with the rule that says so: without it a tape row
	 * scrolled halfway under the angle-mode control read as a clipped row rather than
	 * as content passing behind a fixed header.
	 */
	.pie-cortex-display__head {
		display: flex;
		align-items: center;
		flex: 0 0 auto;
		gap: var(--cortex-space-2, 0.5rem);
		min-width: 0;
		padding-inline: var(--cortex-tape-inset, 0.75rem);
		padding-bottom: var(--cortex-space-2, 0.5rem);
		border-bottom: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
	}

	.pie-cortex-display__scroll {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: var(--cortex-space-2, 0.5rem);
		flex: 1 1 auto;
		min-height: 0;
		min-width: 0;
		/*
		 * The scroller sits below the pane's head rather than on the pane itself, so
		 * the angle-mode control stays pinned while the tape scrolls under it. One
		 * scroll container for tape, active line and answer means they share a single
		 * content box — so they share one right edge, which is what makes the tape's
		 * result column and the display's answer read as one column of numbers. A
		 * scroller on the tape alone put its reserved gutter inside a box the active
		 * line did not have, leaving the two right edges a few pixels apart.
		 */
		overflow-y: auto;
		scrollbar-gutter: stable;
		scrollbar-width: thin;
	}

	.pie-cortex-tape {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.pie-cortex-tape__row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--cortex-space-2, 0.5rem);
		width: 100%;
		/* Same inset as the mathfield, so history and the live line share one edge. */
		padding: 0.2rem var(--cortex-tape-inset, 0.75rem);
		border: none;
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.9375rem;
		text-align: start;
		cursor: pointer;
	}

	.pie-cortex-tape__row:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-tape__expression {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.pie-cortex-tape__result {
		flex: 0 0 auto;
		font-weight: 600;
		/* A column of results only reads as a tape when the digits line up. */
		font-variant-numeric: tabular-nums;
	}

	.pie-cortex-active-line {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.pie-cortex-result {
		/*
		 * The largest text on the surface. It was 1.2rem under a 1.5rem heading, which
		 * is what made the answer look like a footnote to its own calculator.
		 */
		padding-inline: var(--cortex-tape-inset, 0.75rem);
		font-size: var(--cortex-result-font-size, 1.75rem);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
		text-align: end;
		min-height: 1.2em;
	}

	.pie-cortex-error {
		padding: 0.5rem 0.6rem;
		border-inline-start: 4px solid var(--pie-incorrect, var(--cortex-incorrect));
		background: var(--pie-incorrect-secondary, var(--cortex-incorrect-secondary));
		color: var(--pie-content-emphasis, var(--cortex-content-emphasis));
		font-size: 0.875rem;
	}

	.pie-cortex-error[hidden] {
		display: none;
	}

	/*
	 * The one chrome row the keypad calculators spend, and it sits against the keypad
	 * because that is what it edits. Layer tabs, backspace and clear come to ~295px
	 * of the 354px a 380px panel gives, so the row does not wrap at any shipped size;
	 * the angle mode is in the display pane rather than here because adding it took
	 * the row past that width and a wrap costs 44px. The keypad's `=` is the commit
	 * control and carries the localized `calculate` name.
	 */
	.pie-cortex-calculator__edits {
		display: flex;
		align-items: center;
		/* A left-anchored group with one gap. Not `space-between`. */
		gap: var(--cortex-space-1, 0.375rem);
		flex-wrap: wrap;
		min-width: 0;
	}

	.pie-cortex-keypad__layers {
		display: flex;
		/* Wraps rather than running off the panel at 320px / 400% zoom. */
		flex-wrap: wrap;
		gap: 0.25rem;
		min-width: 0;
	}

	/* Pushes the edit controls to the far end, so the row reads layers | edits. */
	.pie-cortex-calculator__edits-end {
		margin-inline-start: auto;
	}

	.pie-cortex-tape__clear {
		align-self: flex-start;
		/*
		 * 1.75rem, because at its text's own height this button rendered 96x20 and
		 * 2.5.8 sets 24px as the floor for a target. It is the one control in the tool
		 * that was under it.
		 */
		display: flex;
		align-items: center;
		min-height: 1.75rem;
		margin-top: 0.15rem;
		padding: 0.15rem var(--cortex-tape-inset, 0.75rem);
		border: none;
		background: none;
		color: inherit;
		font: inherit;
		font-size: 0.75rem;
		text-decoration: underline;
		cursor: pointer;
	}

	/*
	 * A tab strip on the keypad's plane, not a row of pills on the card: one filled
	 * tab and the rest carried by the plane itself. The transparent border is held
	 * rather than dropped so selecting a tab does not resize the row.
	 */
	.pie-cortex-layer-tab {
		min-height: 2.25rem;
		padding-inline: 0.6rem;
		border: 1px solid transparent;
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: none;
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 600;
		cursor: pointer;
		transition: background-color 0.12s ease, border-color 0.12s ease;
	}

	.pie-cortex-layer-tab--active {
		border-color: var(--pie-primary, var(--cortex-primary));
		background: var(--pie-primary, var(--cortex-primary));
		color: var(--pie-white, var(--cortex-on-primary));
	}

	.pie-cortex-layer-tab:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-layer-tab--active:hover {
		background: var(--pie-primary-dark, var(--pie-primary, var(--cortex-primary)));
	}

	.pie-cortex-icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.25rem;
		padding: 0.35rem;
		font-size: 1.125rem;
		line-height: 1;
	}

	.pie-cortex-action-button {
		min-height: 2.25rem;
		padding: 0.35rem 0.55rem;
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.12s ease, border-color 0.12s ease;
	}

	.pie-cortex-action-button:hover {
		background: var(--pie-button-hover-bg, var(--cortex-button-hover-bg));
	}

	.pie-cortex-action-button:active {
		background: var(--pie-button-active-bg, var(--cortex-button-active-bg));
	}

	.pie-cortex-action-button:focus-visible,
	.pie-cortex-layer-tab:focus-visible,
	.pie-cortex-tape__clear:focus-visible,
	.pie-cortex-tape__row:focus-visible,
	.pie-cortex-angle-mode__segment:focus-visible {
		position: relative;
		z-index: 1;
		outline: 3px solid var(--pie-button-focus-outline, var(--cortex-focus-outline));
		outline-offset: 2px;
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

	/* Narrow panel: the action row's labels are the first thing to give way. */
	@container pie-cortex-calculator (max-width: 22rem) {
		.pie-cortex-calculator {
			--cortex-space-3: 0.5rem;
			/*
			 * Moved in step, because it is the keypad's inline padding that this token
			 * also sets: the screen's rows and the first key column share a left edge
			 * only while the two values are equal. Graphing takes the `padding` here;
			 * the keypad types set it to zero and are unaffected.
			 */
			--cortex-tape-inset: 0.5rem;
			padding: var(--cortex-space-3, 0.5rem);
		}

		.pie-cortex-calculator__edits > * {
			flex: 1 1 5rem;
		}
	}

	@media (forced-colors: active) {
		.pie-cortex-action-button,
		.pie-cortex-icon-button,
		.pie-cortex-layer-tab,
		.pie-cortex-angle-mode__segment {
			border-color: ButtonBorder;
			background: ButtonFace;
			color: ButtonText;
			forced-color-adjust: none;
		}

		.pie-cortex-angle-mode__segment--active,
		.pie-cortex-layer-tab--active {
			background: Highlight;
			color: HighlightText;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pie-cortex-action-button,
		.pie-cortex-layer-tab,
		.pie-cortex-angle-mode__segment {
			transition: none;
		}
	}
</style>
