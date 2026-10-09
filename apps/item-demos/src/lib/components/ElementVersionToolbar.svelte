<script lang="ts">
	import {
		extractPackageInfo,
		type ElementOverrides,
	} from "@pie-players/pie-players-shared/pie";
	import ElementVersionSelector from "./ElementVersionSelector.svelte";

	type ElementsMap = Record<string, string>;

	interface Props {
		elements: ElementsMap;
		overrides: ElementOverrides;
		onChange?: (detail: { packageName: string; version: string }) => void;
		onResetOne?: (detail: { packageName: string }) => void;
		onResetAll?: () => void;
	}

	let {
		elements = {},
		overrides = {},
		onChange,
		onResetOne,
		onResetAll,
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
				defaultVersion: info.version || "latest",
			});
		}
		return result;
	});

	const hasOverrides = $derived(
		Object.keys(overrides || {}).length > 0,
	);

	function resolvedVersion(packageName: string, fallbackVersion: string): string {
		return overrides?.[packageName] || fallbackVersion;
	}
</script>

{#if packageInfos.length > 0}
	<div class="card bg-base-200 shadow-sm mb-5">
		<div class="card-body py-3 px-4">
			{#if hasOverrides}
				<div class="flex items-center justify-end mb-2">
					<button
						class="btn btn-xs btn-outline"
						onclick={() => onResetAll?.()}
					>
						Reset all
					</button>
				</div>
			{/if}
			<div class="flex flex-wrap items-center gap-2">
				{#each packageInfos as pkg (pkg.name)}
					<div class="flex items-center gap-2">
						<ElementVersionSelector
							packageName={pkg.name}
							label={pkg.displayName}
							value={resolvedVersion(pkg.name, pkg.defaultVersion)}
							{onChange}
						/>
						{#if overrides?.[pkg.name]}
							<button
								class="btn btn-xs btn-outline"
								onclick={() => onResetOne?.({ packageName: pkg.name })}
								title="Use catalog default version"
							>
								Default
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}
