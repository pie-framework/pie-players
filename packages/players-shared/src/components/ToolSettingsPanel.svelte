<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { createFocusTrap } from '../ui/focus-trap.js';
	import { resolveInterfaceI18n } from '../i18n/provider.js';
	import type { I18nProvider } from '../i18n/types.js';

	let {
		open,
		title,
		onClose,
		anchorEl = null,
		i18n,
		children
	}: {
		open: boolean;
		/** Heading text. Unset, the localized default heading renders. */
		title?: string;
		onClose: () => void;
		anchorEl?: HTMLElement | null;
		/** Interface-locale provider; the English-only default covers its absence. */
		i18n?: I18nProvider;
		children?: Snippet;
	} = $props();

	const messages = $derived(resolveInterfaceI18n({ i18n }));
	const resolvedTitle = $derived(title ?? messages.t('toolkit.settingsTitle'));

	let panelEl = $state<HTMLDivElement | null>(null);
	let panelPosition = $state<{ top: number; left?: number; right?: number } | null>(null);
	let cleanupFocusTrap: (() => void) | null = null;

	$effect(() => {
		if (!open || !panelEl) {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
			return;
		}
		cleanupFocusTrap?.();
		cleanupFocusTrap = createFocusTrap(panelEl, { onEscape: onClose });
		return () => {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
		};
	});

	// Calculate position based on anchor element
	$effect(() => {
		if (open && anchorEl) {
			const anchorRect = anchorEl.getBoundingClientRect();
			const panelWidth = 320; // w-80 = 20rem = 320px
			const spacing = 8; // Gap from anchor

			// Try to position to the right of anchor first
			const rightPosition = anchorRect.right + spacing;
			const hasSpaceOnRight = rightPosition + panelWidth <= window.innerWidth;

			if (hasSpaceOnRight) {
				// Position to the right of anchor
				panelPosition = {
					top: anchorRect.top,
					left: rightPosition
				};
			} else {
				// Position to the left of anchor
				panelPosition = {
					top: anchorRect.top,
					right: window.innerWidth - anchorRect.left + spacing
				};
			}
		} else {
			panelPosition = null;
		}
	});

	onMount(() => {
		const onDocClick = (e: MouseEvent) => {
			if (!open) return;
			const target = e.target as Node | null;
			if (!target) return;
			if (panelEl?.contains(target)) return;
			if (anchorEl?.contains(target)) return;
			onClose();
		};

		document.addEventListener('mousedown', onDocClick);
		return () => {
			cleanupFocusTrap?.();
			cleanupFocusTrap = null;
			document.removeEventListener('mousedown', onDocClick);
		};
	});
</script>

{#if open}
	<div class="fixed inset-0" aria-hidden="true" onmousedown={onClose} style="z-index: 4000;"></div>
	<div
		bind:this={panelEl}
		class="tool-settings-panel fixed w-80 rounded-box bg-base-100 shadow p-3 text-base-content"
		role="dialog"
		aria-label={resolvedTitle}
		tabindex="-1"
		style="z-index: 4100; {panelPosition ? `top: ${panelPosition.top}px; ${panelPosition.left !== undefined ? `left: ${panelPosition.left}px;` : `right: ${panelPosition.right}px;`}` : 'top: 4rem; right: 1rem;'}"
	>
		<div class="flex items-center justify-between gap-2 mb-2">
			<h2 class="font-semibold text-sm">{resolvedTitle}</h2>
			<button type="button" class="btn btn-ghost btn-xs" onclick={onClose} aria-label={messages.t('toolkit.closeSettingsA11y')}>{messages.t('common.close')}</button>
		</div>
		<div class="text-sm">
			{@render children?.()}
		</div>
	</div>
{/if}
