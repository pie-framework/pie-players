<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	let {
		minimized = false,
		onToggle,
		onClose,
		buttonClass = "",
		i18n,
	} = $props<{
		minimized?: boolean;
		onToggle?: () => void;
		onClose?: () => void;
		buttonClass?: string;
		/** Interface-locale provider; the English-only default covers its absence. */
		i18n?: I18nProvider;
	}>();

	const t = $derived(resolveInterfaceI18n({ i18n }));

	const resolvedButtonClass = $derived.by(
		() => (buttonClass || "").trim() || "pie-window-controls__button",
	);
</script>

<button
	class={resolvedButtonClass}
	onclick={onToggle}
	title={t.t(minimized ? "toolkit.maximize" : "toolkit.minimize")}
	aria-label={t.t(
		minimized ? "toolkit.maximizePanelA11y" : "toolkit.minimizePanelA11y",
	)}
>
	{#if minimized}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-window-controls__icon"
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
		</svg>
	{:else}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-window-controls__icon"
			width="12"
			height="12"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	{/if}
</button>
<button
	class={resolvedButtonClass}
	onclick={onClose}
	title={t.t("common.close")}
	aria-label={t.t("toolkit.closePanelA11y")}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		class="pie-window-controls__icon"
		width="12"
		height="12"
		fill="none"
		viewBox="0 0 24 24"
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
	</svg>
</button>

<style>
	.pie-window-controls__button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		padding: 0;
		border: 1px solid var(--pie-button-border, #8f8f8f);
		border-radius: 9999px;
		/* Was a translucent white, which read as a light chip on any dark palette.
		   Opaque and on the certified button pair instead. */
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #334155);
		cursor: pointer;
	}

	.pie-window-controls__button:hover {
		background: var(--pie-button-hover-bg, #f9fafb);
		color: var(--pie-button-hover-color, #111827);
		border-color: var(--pie-button-hover-border, #8b919c);
	}

	.pie-window-controls__button:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #3b82f6);
		outline-offset: 1px;
	}

	.pie-window-controls__icon {
		display: block;
	}
</style>
