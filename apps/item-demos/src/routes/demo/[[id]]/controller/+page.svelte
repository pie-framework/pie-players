<script lang="ts">
	import { untrack } from 'svelte';
	import {
		ensureRegistered,
		findPieController,
		type ConfigEntity,
	} from '@pie-players/pie-players-shared';
	import { config as configStore } from '$lib/stores/demo-state';
	import {
		loadControllerInspectionRows,
		type ControllerInspectionRow,
	} from '$lib/utils/controller-inspector';
	import { demoHeadingName } from '$lib/utils/demo-heading-name';

	let { data } = $props();

	const demoHeading = $derived(demoHeadingName(data.demo?.name));

	let controllerRows = $state<ControllerInspectionRow[]>([]);
	let loadState = $state<'idle' | 'loading' | 'loaded' | 'error'>('idle');
	let loadErrorMessage = $state<string | null>(null);
	let refreshedAt = $state<number | null>(null);
	let lastConfigSignature = '';
	let loadRequestToken = 0;

	function stableStringify(value: unknown): string {
		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	function asConfigEntity(value: unknown): ConfigEntity | null {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		const candidate = value as Partial<ConfigEntity>;
		if (
			typeof candidate.markup !== 'string' ||
			!candidate.elements ||
			typeof candidate.elements !== 'object' ||
			!Array.isArray(candidate.models)
		) {
			return null;
		}
		return candidate as ConfigEntity;
	}

	async function loadControllers(rawConfig: unknown) {
		const requestToken = ++loadRequestToken;
		const config = asConfigEntity(rawConfig);

		if (!config) {
			if (requestToken !== loadRequestToken) return;
			loadState = 'error';
			loadErrorMessage = 'Item config is not available.';
			controllerRows = [];
			refreshedAt = null;
			return;
		}

		loadState = 'loading';
		loadErrorMessage = null;
		controllerRows = [];
		refreshedAt = null;

		const result = await loadControllerInspectionRows(config, {
			ensureRegistered,
			lookupController: findPieController,
		});
		if (requestToken !== loadRequestToken) return;
		controllerRows = result.rows;
		loadState = result.errorMessage ? 'error' : 'loaded';
		loadErrorMessage = result.errorMessage;
		refreshedAt = Date.now();
	}

	$effect(() => {
		const currentConfig = $configStore;
		const configSignature = stableStringify(currentConfig);
		if (configSignature === lastConfigSignature) return;
		lastConfigSignature = configSignature;
		queueMicrotask(() => {
			untrack(() => {
				void loadControllers(currentConfig);
			});
		});
	});
</script>

<svelte:head>
	<title>{demoHeading} - Controller</title>
</svelte:head>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
			<div>
				<h3 class="card-title">Element Controllers</h3>
				<p class="text-sm text-base-content/70">
					Loads the item&apos;s client-player bundles and resolves each model&apos;s controller by
					its full versioned PIE tag.
				</p>
			</div>
			<button
				type="button"
				class="btn btn-sm btn-primary"
				disabled={loadState === 'loading'}
				onclick={() => loadControllers($configStore)}
			>
				{loadState === 'loading' ? 'Loading...' : 'Refresh controllers'}
			</button>
		</div>

		{#if loadState === 'loading'}
			<div class="alert alert-info mt-4" role="status" aria-live="polite">
				<span>Loading controller bundles...</span>
			</div>
		{:else if loadState === 'error' && loadErrorMessage}
			<div class="alert alert-error mt-4" role="alert">
				<span>{loadErrorMessage}</span>
			</div>
		{:else if loadState === 'loaded'}
			<div class="alert alert-success mt-4" role="status" aria-live="polite">
				<span>
					Controllers resolved{refreshedAt
						? ` at ${new Date(refreshedAt).toLocaleTimeString()}`
						: ''}.
				</span>
			</div>
		{/if}

		{#if controllerRows.length > 0}
			<div class="overflow-x-auto mt-4">
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Model</th>
							<th>Element</th>
							<th>Package</th>
							<th>Status</th>
							<th>Controller methods</th>
						</tr>
					</thead>
					<tbody>
						{#each controllerRows as row (`${row.modelId}:${row.element}`)}
							<tr>
								<td class="font-mono text-xs">{row.modelId}</td>
								<td class="font-mono text-xs">{row.element}</td>
								<td class="font-mono text-xs">{row.packageSpec}</td>
								<td>
									<span
										class={`badge ${
											row.status === 'loaded'
												? 'badge-success'
												: row.status === 'missing'
													? 'badge-warning'
													: 'badge-error'
										}`}
									>
										{row.status}
									</span>
									{#if row.error}
										<div class="mt-1 text-xs text-error">{row.error}</div>
									{/if}
								</td>
								<td>
									{#if row.methods.length > 0}
										<div class="flex flex-wrap gap-1">
											{#each row.methods as method}
												<span class="badge badge-outline font-mono text-xs">{method}</span>
											{/each}
										</div>
									{:else}
										<span class="text-sm text-base-content/60">None</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if loadState === 'loaded'}
			<div class="alert mt-4">
				<span>No item models are available for controller inspection.</span>
			</div>
		{/if}
	</div>
</div>
