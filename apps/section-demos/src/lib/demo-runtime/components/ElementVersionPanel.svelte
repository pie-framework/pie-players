<script lang="ts">
	import SharedFloatingPanel from '@pie-players/pie-section-player-tools-shared/SharedFloatingPanel.svelte';
	import {
		extractPackageInfo,
		type ElementOverrides
	} from '@pie-players/pie-players-shared/pie';
	import ElementVersionSelector from '$lib/components/ElementVersionSelector.svelte';

	type ElementsMap = Record<string, string>;

	interface Props {
		elements: ElementsMap;
		overrides: ElementOverrides;
		onChange: (detail: { packageName: string; version: string }) => void;
		onResetOne: (detail: { packageName: string }) => void;
		onResetAll: () => void;
		onClose: () => void;
		persistenceScope?: string;
	}

	let {
		elements = {},
		overrides = {},
		onChange,
		onResetOne,
		onResetAll,
		onClose,
		persistenceScope = ''
	}: Props = $props();

	const packageInfos = $derived.by(() => {
		const result: Array<{
			name: string;
			displayName: string;
			defaultVersion: string;
		}> = [];
		const seen = new Set<string>();
		for (const elementSpec of Object.values(elements || {})) {
			const info = extractPackageInfo(String(elementSpec));
			if (!info.name || seen.has(info.name)) continue;
			seen.add(info.name);
			result.push({
				name: info.name,
				displayName: info.displayName,
				defaultVersion: info.version || 'latest'
			});
		}
		return result;
	});

	const hasOverrides = $derived(Object.keys(overrides || {}).length > 0);

	function resolvedVersion(packageName: string, fallbackVersion: string): string {
		return overrides?.[packageName] || fallbackVersion;
	}
</script>

<SharedFloatingPanel
	title="Element versions"
	ariaLabel="Drag element versions panel"
	minWidth={360}
	minHeight={220}
	initialSizing={{
		widthRatio: 0.34,
		heightRatio: 0.5,
		minWidth: 420,
		maxWidth: 640,
		minHeight: 260,
		maxHeight: 640,
		alignX: 'end',
		alignY: 'start',
		paddingX: 16,
		paddingY: 72
	}}
	className="pie-section-demos-element-version-panel"
	{persistenceScope}
	persistencePanelId="element-version-panel"
	{onClose}
>
	<svelte:fragment slot="icon">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-section-demos-element-version-panel__icon-sm"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
			/>
		</svg>
	</svelte:fragment>

	<div class="pie-section-demos-element-version-panel__body">
		{#if packageInfos.length === 0}
			<p class="pie-section-demos-element-version-panel__empty">
				No PIE elements on this page.
			</p>
		{:else}
			<div class="pie-section-demos-element-version-panel__header">
				<p class="pie-section-demos-element-version-panel__caption">
					Override the version used for each PIE element. Changes reload the page.
				</p>
				{#if hasOverrides}
					<button
						type="button"
						class="btn btn-xs btn-outline"
						onclick={() => onResetAll()}
					>
						Reset all
					</button>
				{/if}
			</div>

			<ul class="pie-section-demos-element-version-panel__list">
				{#each packageInfos as pkg (pkg.name)}
					<li class="pie-section-demos-element-version-panel__row">
						<div class="pie-section-demos-element-version-panel__row-control">
							<ElementVersionSelector
								compact={false}
								packageName={pkg.name}
								label={pkg.displayName}
								value={resolvedVersion(pkg.name, pkg.defaultVersion)}
								on:change={(event) => onChange(event.detail)}
							/>
						</div>
						{#if overrides?.[pkg.name]}
							<button
								type="button"
								class="btn btn-xs btn-outline pie-section-demos-element-version-panel__row-default"
								onclick={() => onResetOne({ packageName: pkg.name })}
								title="Use catalog default version"
							>
								Default
							</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</SharedFloatingPanel>

<style>
	.pie-section-demos-element-version-panel__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-demos-element-version-panel__body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem 1rem 1rem;
		overflow: auto;
	}

	.pie-section-demos-element-version-panel__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.pie-section-demos-element-version-panel__caption {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.35;
		opacity: 0.75;
	}

	.pie-section-demos-element-version-panel__empty {
		margin: 0;
		font-size: 0.8rem;
		opacity: 0.75;
	}

	.pie-section-demos-element-version-panel__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.pie-section-demos-element-version-panel__row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
	}

	.pie-section-demos-element-version-panel__row-control {
		flex: 1 1 auto;
		min-width: 0;
	}

	.pie-section-demos-element-version-panel__row-default {
		flex: 0 0 auto;
	}
</style>
