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
	// Empty means "the first layer". The tabs live in the utility strip, so the
	// selection is owned here rather than inside the keypad.
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
				announcement = i18n.t('result', { result: value.result });
			}
			snapshot = value;
		}),
	);

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
	data-pie-calculator-type={controller.settings.type}
	data-pie-theme={controller.settings.theme}
	lang={i18n.locale}
	dir={i18n.direction}
	aria-label={typeLabel}
>
	<!--
		Two deliberate rows, not one wrapping row. Four groups (title, layer tabs, edit
		controls, angle mode) in a 356px strip wrapped into four lines and spent ~120px
		of a 372px panel on chrome. Row one identifies and sets the mode; row two is
		the edit surface that belongs next to the keypad.
	-->
	<div class="pie-cortex-calculator__strip">
		<h2 class="pie-cortex-calculator__eyebrow">{typeLabel}</h2>

		{#if showsAngleMode}
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
		{/if}
	</div>

	{#if isGraphing}
		<GraphView {controller} {snapshot} {layers} />
	{:else}
		<div class="pie-cortex-display" bind:this={display}>
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
							<span class="pie-cortex-tape__result" dir="ltr">{entry.result}</span>
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
					type={controller.settings.type}
					localization={i18n}
					restrictedMode={controller.settings.restrictedMode}
					focusRequest={snapshot.focusRequest}
					ownKeypad={true}
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
					{#if snapshot.result}{snapshot.result}{/if}
				</p>
			</div>

			<!-- Always mounted, so the alert exists before it has text to carry. A live
			     region created at the moment its content appears often fails to announce. -->
			<p class="pie-cortex-error" role="alert" hidden={!snapshot.errorCode}>
				{#if snapshot.errorCode}{i18n.errorMessage(snapshot.errorCode)}{/if}
			</p>
		</div>

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
			<button
				type="button"
				class="pie-cortex-action-button pie-cortex-calculator__edits-end"
				onclick={backspace}
			>{i18n.t('backspace')}</button>
			<button
				type="button"
				class="pie-cortex-action-button"
				onclick={() => controller.clear()}
			>{i18n.t('clear')}</button>
		</div>

		<Keypad
			{layers}
			{activeLayerId}
			bleed={true}
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

	.pie-cortex-calculator__strip {
		display: flex;
		align-items: center;
		gap: var(--cortex-space-2, 0.5rem);
		flex-wrap: wrap;
		min-width: 0;
	}

	h2,
	p {
		margin: 0;
	}

	.pie-cortex-calculator__eyebrow {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
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

	.pie-cortex-display {
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: var(--cortex-space-2, 0.5rem);
		/* Takes the slack, and gives it all back when the panel is short. */
		flex: 1 1 auto;
		min-height: 4rem;
		min-width: 0;
		/*
		 * The display is the scroller, not the tape. One scroll container means the
		 * tape rows, the active line and the answer share a single content box — so
		 * they share one right edge, which is what makes the tape's result column and
		 * the display's answer read as one column of numbers. A scroller on the tape
		 * alone put its reserved gutter inside a box the active line did not have,
		 * leaving the two right edges a few pixels apart.
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
		font-size: 1.75rem;
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
	 * Backspace, Clear and Clear history live in the utility strip rather than in a
	 * row of their own — the arrangement both reference calculators use, and the one
	 * that makes the layout fit: a separate 44px row plus its gap cost 52px of a
	 * 372px panel, which is what pushed the keypad past the bottom edge. The keypad's
	 * `=` is the commit control and carries the localized `calculate` name.
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
		gap: 0.25rem;
		min-width: 0;
	}

	/* Pushes the edit controls to the far end, so the row reads layers | edits. */
	.pie-cortex-calculator__edits-end {
		margin-inline-start: auto;
	}

	.pie-cortex-tape__clear {
		align-self: flex-start;
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
			/* The keypad's bleed cancels this same token, so both stay in step. */
			--cortex-space-3: 0.5rem;
			padding: var(--cortex-space-3, 0.5rem);
		}

		.pie-cortex-calculator__edits > * {
			flex: 1 1 5rem;
		}
	}

	/*
	 * A short panel — which is also what 400% zoom produces — must not keep the
	 * keypad pinned to a bottom that no longer exists. Give up `height: 100%` and
	 * let the shell's own `overflow-y: auto` scroll the whole calculator instead.
	 */
	@media (max-height: 30rem) {
		.pie-cortex-calculator {
			height: auto;
			min-height: 100%;
		}

		.pie-cortex-display {
			flex: 0 0 auto;
		}
	}

	@media (forced-colors: active) {
		.pie-cortex-action-button,
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
