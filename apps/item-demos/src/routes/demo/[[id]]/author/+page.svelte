<script lang="ts">
	import { getContext, onMount, untrack } from 'svelte';
	import ModelEditor from '$lib/components/ModelEditor.svelte';

	let { data } = $props();
	const demoState: any = getContext('demo-state');

	let playerEl: any = $state(null);
	let lastConfig: any = null;

	onMount(async () => {
		await import('@pie-players/pie-iife-player');
	});

	// Set properties imperatively when config changes
	$effect(() => {
		const currentConfig = demoState.config;

		if (playerEl && currentConfig) {
			if (currentConfig !== lastConfig) {
				untrack(() => {
					playerEl.config = currentConfig;
					playerEl.session = { id: 'preview', data: [] };
					playerEl.env = { mode: 'view', role: 'instructor' };
				});

				lastConfig = currentConfig;
			}
		}
	});

	function updateModel(modelId: string, changes: any) {
		const updatedModels = demoState.config.models.map((m: any) =>
			m.id === modelId ? { ...m, ...changes } : m
		);
		demoState.config = { ...demoState.config, models: updatedModels };
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Author</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
	<!-- Left: Model Editors -->
	<div class="space-y-4">
		{#each demoState.config.models as model}
			<ModelEditor {model} onUpdate={(changes) => updateModel(model.id, changes)} />
		{/each}
	</div>

	<!-- Right: Preview -->
	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h3 class="card-title">Preview</h3>
			<pie-iife-player
				bind:this={playerEl}
				bundle-host="https://proxy.pie-api.com/bundles/"
			></pie-iife-player>
		</div>
	</div>
</div>
