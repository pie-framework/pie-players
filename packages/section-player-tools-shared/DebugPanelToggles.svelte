<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

	interface Props {
		showSessionPanel: boolean;
		showEventPanel: boolean;
		showDbPanel?: boolean;
		showInstrumentationPanel?: boolean;
		onToggleSessionPanel: () => void;
		onToggleEventPanel: () => void;
		onToggleDbPanel?: () => void;
		onToggleInstrumentationPanel?: () => void;
		/** Interface-locale provider; the English-only default covers its absence. */
		i18n?: I18nProvider;
	}

	let {
		showSessionPanel,
		showEventPanel,
		showDbPanel = false,
		showInstrumentationPanel = false,
		onToggleSessionPanel,
		onToggleEventPanel,
		onToggleDbPanel,
		onToggleInstrumentationPanel,
		i18n,
	}: Props = $props();

	const t = $derived(resolveInterfaceI18n({ i18n }));
</script>

<button
	type="button"
	class="pie-debug-panel-toggles__button"
	onclick={onToggleSessionPanel}
	title={t.t("debug.session")}
	aria-label={t.t("debug.toggleSessionPanelA11y")}
	aria-pressed={showSessionPanel}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="pie-debug-panel-toggles__icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
	</svg>
</button>

<button
	type="button"
	class="pie-debug-panel-toggles__button"
	onclick={onToggleEventPanel}
	title={t.t("debug.events")}
	aria-label={t.t("debug.toggleEventPanelA11y")}
	aria-pressed={showEventPanel}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="pie-debug-panel-toggles__icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0l-3-3m3 3l-3 3M3 17h8m0 0l-3-3m3 3l-3 3M3 7h5m8 10h5" />
	</svg>
</button>

{#if onToggleDbPanel}
	<button
		type="button"
		class="pie-debug-panel-toggles__button"
		onclick={onToggleDbPanel}
		title={t.t("debug.databaseState")}
		aria-label={t.t("debug.toggleDatabasePanelA11y")}
		aria-pressed={showDbPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="pie-debug-panel-toggles__icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<ellipse cx="12" cy="5" rx="7" ry="3" stroke-width="2"></ellipse>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5v7c0 1.66 3.13 3 7 3s7-1.34 7-3V5M5 12v7c0 1.66 3.13 3 7 3s7-1.34 7-3v-7"></path>
		</svg>
	</button>
{/if}

{#if onToggleInstrumentationPanel}
	<button
		type="button"
		class="pie-debug-panel-toggles__button"
		onclick={onToggleInstrumentationPanel}
		title={t.t("debug.instrumentation")}
		aria-label={t.t("debug.toggleInstrumentationPanelA11y")}
		aria-pressed={showInstrumentationPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="pie-debug-panel-toggles__icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h4l2 6 4-14 2 8h4" />
		</svg>
	</button>
{/if}

<style>
	/* On the button tokens, so the toggles follow the PIE scheme the panels they
	   open already do; DaisyUI's classes followed the host's palette instead. */
	.pie-debug-panel-toggles__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid var(--pie-button-border, #8f8f8f);
		border-radius: 0.25rem;
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
		cursor: pointer;
	}

	.pie-debug-panel-toggles__button:hover {
		background: var(--pie-button-hover-bg, #f9fafb);
		color: var(--pie-button-hover-color, #111827);
		border-color: var(--pie-button-hover-border, #8b919c);
	}

	.pie-debug-panel-toggles__button[aria-pressed="true"] {
		/* The certified active pair, kept together: `--pie-button-active-bg` is only
		   guaranteed against `--pie-button-color`. The fill alone sits close to the
		   resting one, so an ink-coloured ring carries the pressed state. */
		background: var(--pie-button-active-bg, #f3f4f6);
		color: var(--pie-button-color, #374151);
		border-color: var(--pie-button-color, #374151);
		box-shadow: inset 0 0 0 1px var(--pie-button-color, #374151);
	}

	.pie-debug-panel-toggles__button:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #3b82f6);
		outline-offset: 2px;
	}

	.pie-debug-panel-toggles__icon {
		display: block;
		width: 1rem;
		height: 1rem;
	}
</style>
