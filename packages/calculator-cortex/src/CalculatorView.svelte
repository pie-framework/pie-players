<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import GraphView from './GraphView.svelte';
	import MathFieldInput from './MathFieldInput.svelte';
	import type { CortexCalculatorController } from './calculator-controller.js';

	let { controller }: { controller: CortexCalculatorController } = $props();
	let snapshot = $state(untrack(() => controller.getSnapshot()));
	const i18n = $derived(controller.settings.localization);

	const typeLabel = $derived(
		controller.settings.type === 'basic'
			? i18n.t('basicCalculator')
			: controller.settings.type === 'scientific'
				? i18n.t('scientificCalculator')
				: i18n.t('graphingCalculator'),
	);

	async function evaluate(): Promise<void> {
		try {
			await controller.evaluate();
		} catch {
			// The controller publishes the accessible error state.
		}
	}

	function backspace(): void {
		controller.setValue(snapshot.inputLatex.slice(0, -1));
		controller.requestFocus();
	}

	onMount(() => controller.subscribe((value) => (snapshot = value)));
</script>

<section
	class="pie-cortex-calculator"
	data-pie-calculator-type={controller.settings.type}
	data-pie-theme={controller.settings.theme}
	lang={i18n.locale}
	dir={i18n.direction}
	aria-label={typeLabel}
>
	<header class="pie-cortex-calculator__heading">
		<h2>{typeLabel}</h2>
		{#if controller.settings.type !== 'basic'}
			<label class="pie-cortex-angle-mode">
				{i18n.t('angleMode')}
				<select
					value={snapshot.angleMode}
					onchange={(event) =>
						controller.setAngleMode(
							(event.currentTarget as HTMLSelectElement).value as 'degree' | 'radian',
						)}
				>
					<option value="degree">{i18n.t('degrees')}</option>
					<option value="radian">{i18n.t('radians')}</option>
				</select>
			</label>
		{/if}
	</header>

	{#if controller.settings.type === 'graphing'}
		<GraphView {controller} {snapshot} />
	{:else}
		<div class="pie-cortex-calculator__input">
			<MathFieldInput
				value={snapshot.inputLatex}
				label={i18n.t('expressionLabel', { calculator: typeLabel })}
				type={controller.settings.type}
				localization={i18n}
				restrictedMode={controller.settings.restrictedMode}
				focusRequest={snapshot.focusRequest}
				onInput={(value) => controller.setValue(value)}
				onCommit={evaluate}
			/>
		</div>
	{/if}

	<div class="pie-cortex-calculator__actions">
		{#if controller.settings.type !== 'graphing'}
			<button
				type="button"
				class="pie-cortex-primary-button"
				disabled={snapshot.busy}
				onclick={evaluate}
			>{snapshot.busy ? i18n.t('calculating') : i18n.t('calculate')}</button
			>
			<button type="button" class="pie-cortex-action-button" onclick={backspace}>{i18n.t('backspace')}</button>
		{/if}
		<button type="button" class="pie-cortex-action-button" onclick={() => controller.clear()}>
			{i18n.t('clear')}
		</button>
	</div>

	<div class="pie-cortex-calculator__feedback">
		<p class="pie-cortex-result" role="status" aria-live="polite" aria-atomic="true">
			{#if snapshot.result}{i18n.t('result', { result: snapshot.result })}{/if}
		</p>
		{#if snapshot.errorCode}
			<p class="pie-cortex-error" role="alert">{i18n.errorMessage(snapshot.errorCode)}</p>
		{/if}
	</div>

	{#if controller.settings.historyLimit > 0 && snapshot.history.length > 0}
		<details class="pie-cortex-history">
			<summary>{i18n.t('calculationHistory')}</summary>
			<ol>
				{#each snapshot.history as entry}
					<li>
						<button
							type="button"
							class="pie-cortex-history-button"
							onclick={() => {
								controller.setValue(entry.expression);
								controller.requestFocus();
							}}
						>
							<span>{entry.expression}</span>
							<span aria-hidden="true"> = </span>
							<span>{entry.result}</span>
						</button>
					</li>
				{/each}
			</ol>
			<button type="button" class="pie-cortex-action-button" onclick={() => controller.clearHistory()}>
				{i18n.t('clearHistory')}
			</button>
		</details>
	{/if}
</section>

<style>
	.pie-cortex-calculator {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: 100%;
		height: 100%;
		min-width: 0;
		padding: 1rem;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #0f172a);
		font-family: var(--pie-font-family, system-ui, sans-serif);
	}

	.pie-cortex-calculator[data-pie-theme='light'] {
		color-scheme: light;
		--pie-background: #fff;
		--pie-background-dark: #f8fafc;
		--pie-text: #0f172a;
		--pie-border: #64748b;
		--pie-button-bg: #fff;
		--pie-button-color: #0f172a;
		--pie-button-border: #64748b;
		--pie-primary: #1d4ed8;
		--pie-white: #fff;
		--pie-button-focus-outline: #2563eb;
		--pie-incorrect: #b91c1c;
		--pie-incorrect-secondary: #fef2f2;
		--pie-content-emphasis: #7f1d1d;
		--cortex-default-series-1: #075985;
		--cortex-default-series-2: #9f1239;
		--cortex-default-series-3: #166534;
		--cortex-default-series-4: #6b21a8;
		--cortex-default-series-5: #9a3412;
		--cortex-default-series-6: #334155;
	}

	.pie-cortex-calculator[data-pie-theme='dark'] {
		color-scheme: dark;
		--pie-background: #111827;
		--pie-background-dark: #1f2937;
		--pie-text: #f8fafc;
		--pie-border: #cbd5e1;
		--pie-button-bg: #1f2937;
		--pie-button-color: #f8fafc;
		--pie-button-border: #94a3b8;
		--pie-primary: #ffff00;
		--pie-white: #000;
		--pie-button-focus-outline: #93c5fd;
		--pie-incorrect: #ff6666;
		--pie-incorrect-secondary: #330000;
		--pie-content-emphasis: #ff9999;
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
			--pie-background: #111827;
			--pie-background-dark: #1f2937;
			--pie-text: #f8fafc;
			--pie-border: #cbd5e1;
			--pie-button-bg: #1f2937;
			--pie-button-color: #f8fafc;
			--pie-button-border: #94a3b8;
			--pie-primary: #ffff00;
			--pie-white: #000;
			--pie-button-focus-outline: #93c5fd;
			--pie-incorrect: #ff6666;
			--pie-incorrect-secondary: #330000;
			--pie-content-emphasis: #ff9999;
			--cortex-default-series-1: #7dd3fc;
			--cortex-default-series-2: #fda4af;
			--cortex-default-series-3: #86efac;
			--cortex-default-series-4: #d8b4fe;
			--cortex-default-series-5: #fdba74;
			--cortex-default-series-6: #cbd5e1;
		}
	}

	.pie-cortex-calculator__heading,
	.pie-cortex-calculator__actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	h2,
	p {
		margin: 0;
	}

	.pie-cortex-angle-mode {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.pie-cortex-primary-button,
	.pie-cortex-action-button,
	.pie-cortex-history-button,
	select,
	summary {
		min-height: 2.75rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid var(--pie-button-border, var(--pie-border, #64748b));
		border-radius: 0.35rem;
		background: var(--pie-button-bg, var(--pie-background, #fff));
		color: var(--pie-button-color, var(--pie-text, #0f172a));
		font: inherit;
		cursor: pointer;
	}

	.pie-cortex-primary-button {
		border-color: var(--pie-primary, #1d4ed8);
		background: var(--pie-primary, #1d4ed8);
		color: var(--pie-white, #fff);
		font-weight: 700;
	}

	.pie-cortex-primary-button:focus-visible,
	.pie-cortex-action-button:focus-visible,
	.pie-cortex-history-button:focus-visible,
	select:focus-visible,
	summary:focus-visible {
		outline: 3px solid var(--pie-button-focus-outline, #2563eb);
		outline-offset: 2px;
	}

	.pie-cortex-primary-button:disabled,
	.pie-cortex-action-button:disabled {
		cursor: not-allowed;
		opacity: 0.65;
	}

	.pie-cortex-calculator__feedback {
		min-height: 2.5rem;
	}

	.pie-cortex-result {
		font-size: 1.2rem;
		font-weight: 700;
	}

	.pie-cortex-error {
		margin-top: 0.35rem;
		padding: 0.6rem;
		border-inline-start: 4px solid var(--pie-incorrect, #b91c1c);
		background: var(--pie-incorrect-secondary, #fef2f2);
		color: var(--pie-content-emphasis, #7f1d1d);
	}

	.pie-cortex-history ol {
		margin: 0.5rem 0;
		padding-inline-start: 1.5rem;
	}

	.pie-cortex-history-button {
		display: flex;
		gap: 0.35rem;
		width: 100%;
		text-align: start;
	}

	@media (max-width: 20rem) {
		.pie-cortex-calculator {
			padding: 0.65rem;
		}

		.pie-cortex-calculator__actions > * {
			flex: 1 1 8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
			transition: none !important;
		}
	}
</style>
