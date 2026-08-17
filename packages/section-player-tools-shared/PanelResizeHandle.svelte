<script lang="ts">
	import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";

	let {
		onPointerDown,
		handleClass = "pie-panel-resize-handle",
		iconClass = "pie-panel-resize-icon",
		i18n,
	} = $props<{
		onPointerDown?: (event: MouseEvent) => void;
		handleClass?: string;
		iconClass?: string;
		/** Interface-locale provider; the English-only default covers its absence. */
		i18n?: I18nProvider;
	}>();

	const label = $derived(resolveInterfaceI18n({ i18n }).t("toolkit.resizeWindow"));
</script>

<div
	class={handleClass}
	onmousedown={onPointerDown}
	role="button"
	tabindex="0"
	title={label}
	aria-label={label}
>
	<svg class={iconClass} viewBox="0 0 16 16" fill="currentColor">
		<path d="M16 16V14H14V16H16Z" />
		<path d="M16 11V9H14V11H16Z" />
		<path d="M13 16V14H11V16H13Z" />
	</svg>
</div>

<style>
	.pie-panel-resize-handle {
		position: absolute;
		right: 0;
		bottom: 0;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: nwse-resize;
		opacity: 0.82;
		z-index: 2;
	}

	.pie-panel-resize-handle:hover {
		opacity: 1;
	}

	.pie-panel-resize-icon {
		width: 100%;
		height: 100%;
		/* A decorative grip, exempt from 1.4.11, so the faded share stays. What
		   changes is whose ink it fades: the scheme's, not DaisyUI's. */
		color: color-mix(in srgb, var(--pie-text, #334155) 30%, transparent);
	}
</style>
