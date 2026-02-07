<script lang="ts">
	import { getContext } from 'svelte';
	import JsonEditor from '$lib/components/JsonEditor.svelte';

	let { data } = $props();
	const demoState: any = getContext('demo-state');

	let editedConfigJson = $state(JSON.stringify(demoState.config, null, 2));
	let isValid = $state(true);
	let parseError = $state<string | null>(null);

	function handleInput(value: string) {
		editedConfigJson = value;
		try {
			JSON.parse(value);
			isValid = true;
			parseError = null;
		} catch (e: any) {
			isValid = false;
			parseError = e.message;
		}
	}

	function applyChanges() {
		if (isValid) {
			demoState.config = JSON.parse(editedConfigJson);
		}
	}

	function formatJson() {
		if (isValid) {
			const parsed = JSON.parse(editedConfigJson);
			editedConfigJson = JSON.stringify(parsed, null, 2);
		}
	}

	function resetChanges() {
		editedConfigJson = JSON.stringify(demoState.config, null, 2);
		isValid = true;
		parseError = null;
	}

	// External sync: config changes from other tabs
	$effect(() => {
		const currentConfig = demoState.config;
		const currentJson = JSON.stringify(currentConfig, null, 2);
		// Only update if different to avoid cursor jumps
		if (currentJson !== editedConfigJson && isValid) {
			editedConfigJson = currentJson;
		}
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - Source</title>
</svelte:head>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<div class="flex justify-between items-center mb-4">
			<h3 class="card-title">Item Config (JSON)</h3>
			<div class="flex gap-2">
				<button class="btn btn-sm" onclick={formatJson} disabled={!isValid}> Format </button>
				<button
					class="btn btn-sm"
					onclick={() => navigator.clipboard.writeText(editedConfigJson)}
				>
					Copy
				</button>
				<button class="btn btn-sm btn-primary" onclick={applyChanges} disabled={!isValid}>
					Apply
				</button>
				<button class="btn btn-sm" onclick={resetChanges}> Reset </button>
			</div>
		</div>

		{#if parseError}
			<div class="alert alert-error mb-4">
				<span>Parse Error: {parseError}</span>
			</div>
		{/if}

		<JsonEditor value={editedConfigJson} onInput={handleInput} />
	</div>
</div>
