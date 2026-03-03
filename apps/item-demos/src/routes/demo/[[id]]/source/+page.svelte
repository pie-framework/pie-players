<script lang="ts">
	import { get } from 'svelte/store';
	import JsonEditor from '$lib/components/JsonEditor.svelte';
	import { config as configStore, updateConfig } from '$lib/stores/demo-state';

	let { data } = $props();

	let editedConfigJson = $state(JSON.stringify(get(configStore), null, 2));
	let lastSyncedConfigJson = $state(JSON.stringify(get(configStore), null, 2));
	let isDirty = $state(false);
	let isValid = $state(true);
	let parseError = $state<string | null>(null);
	let validationError = $state<string | null>(null);
	let actionMessage = $state<string | null>(null);
	let actionTone = $state<'success' | 'info' | 'error'>('info');

	function validateConfigShape(parsed: any): string | null {
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return 'Config must be a JSON object.';
		}
		if (typeof parsed.markup !== 'string' || !parsed.markup.trim()) {
			return "Config must include a non-empty 'markup' string.";
		}
		if (!parsed.elements || typeof parsed.elements !== 'object' || Array.isArray(parsed.elements)) {
			return "Config must include an 'elements' object.";
		}
		if (!Array.isArray(parsed.models)) {
			return "Config must include a 'models' array.";
		}
		return null;
	}

	function validateEditorValue(value: string): any | null {
		try {
			const parsed = JSON.parse(value);
			parseError = null;
			validationError = validateConfigShape(parsed);
			isValid = !validationError;
			return parsed;
		} catch (e: any) {
			parseError = e.message;
			validationError = null;
			isValid = false;
			return null;
		}
	}

	function handleInput(value: string) {
		editedConfigJson = value;
		isDirty = editedConfigJson !== lastSyncedConfigJson;
		validateEditorValue(value);
		actionMessage = null;
	}

	function applyChanges() {
		const parsed = validateEditorValue(editedConfigJson);
		if (!parsed) {
			actionTone = 'error';
			actionMessage = 'Fix JSON errors before applying.';
			return;
		}

		const normalized = JSON.stringify(parsed, null, 2);
		updateConfig(parsed);
		editedConfigJson = normalized;
		lastSyncedConfigJson = normalized;
		isDirty = false;
		actionTone = 'success';
		actionMessage = 'Changes applied.';
	}

	function formatJson() {
		const parsed = validateEditorValue(editedConfigJson);
		if (!parsed) return;
		editedConfigJson = JSON.stringify(parsed, null, 2);
		isDirty = editedConfigJson !== lastSyncedConfigJson;
		actionTone = 'info';
		actionMessage = 'JSON formatted.';
	}

	function resetChanges() {
		const currentJson = JSON.stringify($configStore, null, 2);
		editedConfigJson = currentJson;
		lastSyncedConfigJson = currentJson;
		isDirty = false;
		validateEditorValue(currentJson);
		actionTone = 'info';
		actionMessage = 'Changes reset.';
	}

	async function copyJson() {
		try {
			await navigator.clipboard.writeText(editedConfigJson);
			actionTone = 'success';
			actionMessage = 'JSON copied to clipboard.';
		} catch {
			actionTone = 'error';
			actionMessage = 'Copy failed. Make sure the page has focus.';
		}
	}

	// External sync: config changes from other tabs
	$effect(() => {
		const currentConfig = $configStore;
		const currentJson = JSON.stringify(currentConfig, null, 2);
		// Only sync when there is no local unsaved edit; prevents caret resets while typing.
		if (!isDirty && currentJson !== lastSyncedConfigJson) {
			editedConfigJson = currentJson;
			lastSyncedConfigJson = currentJson;
			validateEditorValue(currentJson);
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
				<button class="btn btn-sm" onclick={copyJson}>
					Copy
				</button>
				<button class="btn btn-sm btn-primary" onclick={applyChanges} disabled={!isValid || !isDirty}>
					Apply
				</button>
				<button class="btn btn-sm" onclick={resetChanges} disabled={!isDirty}> Reset </button>
			</div>
		</div>

		{#if parseError}
			<div class="alert alert-error mb-4">
				<span>Parse Error: {parseError}</span>
			</div>
		{:else if validationError}
			<div class="alert alert-warning mb-4">
				<span>Validation Error: {validationError}</span>
			</div>
		{/if}

		{#if actionMessage}
			<div class={`alert mb-4 ${actionTone === 'success' ? 'alert-success' : actionTone === 'error' ? 'alert-error' : 'alert-info'}`}>
				<span>{actionMessage}</span>
			</div>
		{/if}

		{#if isDirty}
			<div class="text-sm text-base-content/70 mb-3">Unsaved changes</div>
		{/if}

		<JsonEditor value={editedConfigJson} onInput={handleInput} />
	</div>
</div>
