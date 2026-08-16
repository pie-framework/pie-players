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
	class="btn btn-sm btn-outline btn-square"
	class:btn-active={showSessionPanel}
	onclick={onToggleSessionPanel}
	title={t.t("debug.session")}
	aria-label={t.t("debug.toggleSessionPanelA11y")}
	aria-pressed={showSessionPanel}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
	</svg>
</button>

<button
	type="button"
	class="btn btn-sm btn-outline btn-square"
	class:btn-active={showEventPanel}
	onclick={onToggleEventPanel}
	title={t.t("debug.events")}
	aria-label={t.t("debug.toggleEventPanelA11y")}
	aria-pressed={showEventPanel}
>
	<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0l-3-3m3 3l-3 3M3 17h8m0 0l-3-3m3 3l-3 3M3 7h5m8 10h5" />
	</svg>
</button>

{#if onToggleDbPanel}
	<button
		type="button"
		class="btn btn-sm btn-outline btn-square"
		class:btn-active={showDbPanel}
		onclick={onToggleDbPanel}
		title={t.t("debug.databaseState")}
		aria-label={t.t("debug.toggleDatabasePanelA11y")}
		aria-pressed={showDbPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<ellipse cx="12" cy="5" rx="7" ry="3" stroke-width="2"></ellipse>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5v7c0 1.66 3.13 3 7 3s7-1.34 7-3V5M5 12v7c0 1.66 3.13 3 7 3s7-1.34 7-3v-7"></path>
		</svg>
	</button>
{/if}

{#if onToggleInstrumentationPanel}
	<button
		type="button"
		class="btn btn-sm btn-outline btn-square"
		class:btn-active={showInstrumentationPanel}
		onclick={onToggleInstrumentationPanel}
		title={t.t("debug.instrumentation")}
		aria-label={t.t("debug.toggleInstrumentationPanelA11y")}
		aria-pressed={showInstrumentationPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h4l2 6 4-14 2 8h4" />
		</svg>
	</button>
{/if}
