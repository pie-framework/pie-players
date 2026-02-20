<script lang="ts">
	import type { PassageEntity, RubricBlock } from '@pie-players/pie-players-shared/types';
	import '@pie-players/pie-iife-player';

	let {
		passage,
		rubricBlocks = [],
		bundleHost,
		env
	}: {
		passage: PassageEntity | null;
		rubricBlocks?: RubricBlock[];
		bundleHost?: string;
		env: { mode: string; role?: string };
	} = $props();

	const passageConfig = $derived(passage?.config || null);
	const blocks = $derived((rubricBlocks ?? []).filter((b) => !!b?.content));
</script>

{#if blocks.length}
	<div class="passage-panel">
		{#each blocks as block, idx (idx)}
			<div class="rubric-block prose max-w-none">
				{@html block.content}
			</div>
			{#if idx < blocks.length - 1}
				<hr class="separator" />
			{/if}
		{/each}
	</div>
{:else if passageConfig}
	<div class="passage-panel">
		<pie-iife-player
			config={passageConfig}
			env={env}
			session={{ id: '', data: [] }}
			hosted={false}
			show-bottom-border={false}
			bundle-host={bundleHost}
		></pie-iife-player>
	</div>
{:else}
	<div class="passage-panel empty">
		<p class="empty-message">No passage available for this item.</p>
	</div>
{/if}

<style>
	.passage-panel {
		height: 100%;
		padding: 1rem;
		overflow-y: auto;
	}

	.separator {
		border: none;
		border-top: 1px solid var(--pie-border, #e0e0e0);
		margin: 1rem 0;
	}

	.passage-panel.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--pie-text-secondary, #666);
	}

	.empty-message {
		font-style: italic;
	}
</style>

