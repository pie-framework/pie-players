<!--
  PiePreviewToggle - Toggle between authoring and preview modes

  Simple tab-based interface for switching between author and preview views.
  Emits mode changes via callback prop.
-->
<script lang="ts">
	import { createPieLogger, isGlobalDebugEnabled } from '../pie/logger.js';

	const logger = createPieLogger('pie-preview-toggle', () => isGlobalDebugEnabled());

	// Props using Svelte 5 runes
	let {
		mode = 'author' as 'author' | 'preview',
		onModeChange
	}: {
		mode?: 'author' | 'preview';
		onModeChange?: (mode: 'author' | 'preview') => void;
	} = $props();

	// Handle mode change
	function handleModeChange(newMode: 'author' | 'preview') {
		logger.debug('[PiePreviewToggle] Mode changed to:', newMode);

		if (onModeChange) {
			onModeChange(newMode);
		}

		// Also dispatch DOM event for backward compatibility
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
			Author
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
			Preview
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
		border-bottom: 2px solid #e0e0e0;
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
		color: #666;
		transition: all 0.2s ease;
		margin-bottom: -2px;
	}

	.toggle-tab:hover {
		color: #333;
		background: rgba(0, 0, 0, 0.05);
	}

	.toggle-tab:focus {
		outline: 2px solid #1976d2;
		outline-offset: 2px;
	}

	.toggle-tab.active {
		color: #1976d2;
		border-bottom-color: #1976d2;
	}

	.toggle-tab:active {
		transform: translateY(1px);
	}
</style>
