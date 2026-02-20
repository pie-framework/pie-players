<script lang="ts">
	import { createLoadItem } from '@pie-players/pie-assessment-toolkit';
	import type { AssessmentEntity } from '@pie-players/pie-players-shared';
	import { onDestroy, onMount } from 'svelte';
	import { ReferenceLayout } from '../reference-layout/index.js';
	import { AssessmentPlayer } from './AssessmentPlayer.js';

	let {
		assessment,
		bundleHost,
		organizationId,
		userName
	}: {
		assessment: AssessmentEntity;
		bundleHost?: string;
		organizationId?: string | null;
		userName?: string;
	} = $props();

	let player = $state<AssessmentPlayer | null>(null);

	onMount(() => {
		// Initialize reference player
		player = new AssessmentPlayer({
			assessment,
			organizationId: organizationId || undefined,
			bundleHost,
			mode: 'gather',
			loadItem: createLoadItem({})
		});

		// Start at first item
		player.start();
	});

	onDestroy(() => {
		player?.destroy();
	});
</script>

{#if player}
	<ReferenceLayout {player} {assessment} {bundleHost} {organizationId} {userName} />
{:else}
	<div class="loading-container">
		<span class="loading loading-spinner loading-lg"></span>
		<p>Loading assessment...</p>
	</div>
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 1rem;
	}

	.loading-container p {
		color: var(--pie-text-secondary, #666);
	}
</style>

