<script lang="ts">
	import type { ItemConfig, ItemEntity } from '@pie-players/pie-players-shared';
	import type { ToolCoordinator } from '../../services/ToolCoordinator';
	import '$lib/tags/pie-iife-player/PieIifePlayer.svelte';
	import PiePlayerStyles from '$lib/components/PiePlayerStyles.svelte';
	import ToolAnswerEliminator from '$lib/tags/tool-answer-eliminator/tool-answer-eliminator.svelte';

	let {
		currentItem,
		config,
		session,
		bundleHost,
		env,
		toolCoordinator,
		isLoading = false
	}: {
		currentItem: ItemEntity | null;
		config: ItemConfig | null;
		session: { id: string; data: any[] };
		bundleHost?: string;
		env: { mode: string; role: string };
		toolCoordinator?: ToolCoordinator;
		isLoading?: boolean;
	} = $props();

	let piePlayerElement = $state<HTMLElement | null>(null);
</script>

<div class="item-panel">
	{#if isLoading}
		<div class="loading-container">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if config}
		<PiePlayerStyles>
			<pie-iife-player
				bind:this={piePlayerElement}
				config={config}
				env={env}
				session={session}
				hosted={false}
				show-bottom-border={false}
				bundle-host={bundleHost}
			></pie-iife-player>
		</PiePlayerStyles>

		<!-- Answer Eliminator (inline tool) -->
		{#if toolCoordinator}
			<ToolAnswerEliminator
				visible={true}
				toolId="answerEliminator"
				strategy="strikethrough"
				buttonAlignment="inline"
				coordinator={toolCoordinator}
			/>
		{/if}
	{:else}
		<div class="empty-container">
			<p class="empty-message">Question could not be loaded.</p>
		</div>
	{/if}
</div>

<style>
	.item-panel {
		height: 100%;
		padding: 1rem;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.loading-container,
	.empty-container {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.empty-message {
		color: var(--pie-text-secondary, #666);
		font-style: italic;
	}
</style>

