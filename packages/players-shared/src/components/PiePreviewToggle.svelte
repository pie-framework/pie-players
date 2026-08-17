<!--
  PiePreviewToggle - Toggle between authoring and preview modes

  Simple tab-based interface for switching between author and preview views.
  Emits mode changes via callback prop.
-->
<script lang="ts">
	import { createPieLogger, isGlobalDebugEnabled } from '../pie/logger.js';
	import { resolveInterfaceI18n } from '../i18n/provider.js';
	import type { I18nProvider } from '../i18n/types.js';

	const logger = createPieLogger('pie-preview-toggle', () => isGlobalDebugEnabled());

	// Props using Svelte 5 runes
	let {
		mode = 'author' as 'author' | 'preview',
		onModeChange,
		i18n
	}: {
		mode?: 'author' | 'preview';
		onModeChange?: (mode: 'author' | 'preview') => void;
		/**
		 * Interface-locale provider. Optional: this control also renders in Studio
		 * preview and authoring harnesses, where nothing publishes one, and the
		 * English-only default covers that.
		 */
		i18n?: I18nProvider;
	} = $props();

	const messages = $derived(resolveInterfaceI18n({ i18n }));

	// Handle mode change
	function handleModeChange(newMode: 'author' | 'preview') {
		logger.debug('[PiePreviewToggle] Mode changed to:', newMode);

		if (onModeChange) {
			onModeChange(newMode);
		}

		// Also dispatch a DOM event so hosts can listen outside Svelte.
		const event = new CustomEvent('mode-changed', {
			detail: { mode: newMode },
			bubbles: true,
			composed: true
		});
		dispatchEvent(event);
	}
</script>

<div class="pie-preview-toggle">
	<div class="toggle-tabs" role="tablist">
		<button
			type="button"
			role="tab"
			class="toggle-tab"
			class:active={mode === 'author'}
			aria-selected={mode === 'author'}
			aria-controls="author-panel"
			onclick={() => handleModeChange('author')}
		>
			{messages.t('common.author')}
		</button>
		<button
			type="button"
			role="tab"
			class="toggle-tab"
			class:active={mode === 'preview'}
			aria-selected={mode === 'preview'}
			aria-controls="preview-panel"
			onclick={() => handleModeChange('preview')}
		>
			{messages.t('common.preview')}
		</button>
	</div>
</div>

<style>
	.pie-preview-toggle {
		display: block;
		width: 100%;
		margin-bottom: 1rem;
	}

	.toggle-tabs {
		display: flex;
		border-bottom: 2px solid var(--pie-border-light, #e0e0e0);
		gap: 0.5rem;
	}

	.toggle-tab {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 3px solid transparent;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 500;
		color: var(--pie-button-color, #666);
		transition: all 0.2s ease;
		margin-bottom: -2px;
	}

	.toggle-tab:hover {
		color: var(--pie-button-hover-color, #333);
		background: color-mix(in srgb, var(--pie-text, #000) 5%, transparent);
	}

	.toggle-tab:focus {
		outline: 2px solid var(--pie-button-focus-outline, #1976d2);
		outline-offset: 2px;
	}

	.toggle-tab.active {
		/* The selected tab is signalled by the underline and the text stepping to
		   full base-content; the accent slots DaisyUI exposes are picked to pair
		   with their own -content colour, not with the page. */
		color: var(--pie-text, #1976d2);
		border-bottom-color: var(--pie-button-focus-outline, #1976d2);
	}

	.toggle-tab:active {
		transform: translateY(1px);
	}
</style>
