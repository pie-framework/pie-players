<script lang="ts">
	// PNP Profile Tester Component
	// Development and testing tool for overriding PNP profiles in real-time.
	// See PNP_TESTING.md for usage documentation.
	import type { PersonalNeedsProfile } from '@pie-players/pie-players-shared/types';
	import {
		EXAMPLE_PNP_CONFIGURATIONS,
		QTI_STANDARD_ACCESS_FEATURES,
		getFeatureCategory,
	} from '@pie-players/pie-assessment-toolkit/services/pnp-standard-features';

	interface Props {
		/** Callback when profile changes */
		onProfileChange?: (profile: PersonalNeedsProfile | null) => void;
		/** Initial profile (optional) */
		initialProfile?: PersonalNeedsProfile | null;
		/** Show compact view */
		compact?: boolean;
		/** Allow custom feature entry */
		allowCustomFeatures?: boolean;
	}

	let {
		onProfileChange = () => {},
		initialProfile = null,
		compact = false,
		allowCustomFeatures = true
	}: Props = $props();

	// Default profile with all tools enabled
	const DEFAULT_ALL_TOOLS_PROFILE = [
		'calculator',
		'calculatorScientific',
		'calculatorGraphing',
		'graphingTool',
		'periodicTable',
		'protractor',
		'ruler',
		'readingGuide',
		'magnification',
		'screenMagnifier',
		'textToSpeech',
		'answerEliminator'
	];

	// Current state - initialize with default profile if no initialProfile provided
	let activeFeatures = $state<Set<string>>(
		new Set(initialProfile?.supports || DEFAULT_ALL_TOOLS_PROFILE),
	);
	let selectedPreset = $state<string | null>(initialProfile ? null : 'default');
	let customFeature = $state('');
	let showCategoryFilter = $state<string | null>(null);
	let searchQuery = $state('');
	let statusMessage = $state('');

	// Computed profile
	$effect(() => {
		const profile: PersonalNeedsProfile = {
			supports: Array.from(activeFeatures),
		};
		onProfileChange(activeFeatures.size > 0 ? profile : null);
	});

	// Get all standard features as array
	const allStandardFeatures = Object.entries(QTI_STANDARD_ACCESS_FEATURES).flatMap(
		([category, features]) =>
			Object.entries(features).map(([key, value]) => ({
				id: value,
				name: key,
				category,
			})),
	);

	// Filter features
	let filteredFeatures = $derived.by(() => {
		let filtered = allStandardFeatures;

		if (showCategoryFilter) {
			filtered = filtered.filter((f) => f.category === showCategoryFilter);
		}

		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(f) =>
					f.id.toLowerCase().includes(query) ||
					f.name.toLowerCase().includes(query),
			);
		}

		return filtered;
	});

	function applyPreset(presetKey: string) {
		const preset = EXAMPLE_PNP_CONFIGURATIONS[presetKey as keyof typeof EXAMPLE_PNP_CONFIGURATIONS];
		if (!preset) return;

		selectedPreset = presetKey;
		// Create a new Set to trigger Svelte 5 reactivity
		activeFeatures = new Set(preset.features);
		statusMessage = `Profile changed to ${preset.label.replace('Example: ', '')}. ${preset.features.length} features enabled.`;
	}

	function toggleFeature(featureId: string) {
		// Create a new Set to trigger Svelte 5 reactivity
		const newFeatures = new Set(activeFeatures);
		const wasEnabled = newFeatures.has(featureId);
		if (wasEnabled) {
			newFeatures.delete(featureId);
		} else {
			newFeatures.add(featureId);
		}
		activeFeatures = newFeatures;
		selectedPreset = null; // Clear preset when manually changing
		statusMessage = `${featureId} ${wasEnabled ? 'disabled' : 'enabled'}. ${activeFeatures.size} features active.`;
	}

	function addCustomFeature() {
		if (customFeature.trim()) {
			const newFeatures = new Set(activeFeatures);
			const featureId = customFeature.trim();
			newFeatures.add(featureId);
			activeFeatures = newFeatures;
			customFeature = '';
			selectedPreset = null;
			statusMessage = `Custom feature ${featureId} added. ${activeFeatures.size} features active.`;
		}
	}

	function clearAll() {
		activeFeatures = new Set();
		selectedPreset = null;
		statusMessage = 'All features cleared.';
	}

	function exportProfile() {
		const profile: PersonalNeedsProfile = {
			supports: Array.from(activeFeatures),
		};
		const json = JSON.stringify(profile, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'pnp-profile.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function importProfile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const profile = JSON.parse(e.target?.result as string) as PersonalNeedsProfile;
				if (profile.supports && Array.isArray(profile.supports)) {
					activeFeatures = new Set(profile.supports);
					selectedPreset = null;
				}
			} catch (err) {
				console.error('Failed to import PNP profile:', err);
			}
		};
		reader.readAsText(file);
	}

	const categories = Object.keys(QTI_STANDARD_ACCESS_FEATURES);
</script>

<div class="pnp-profile-tester" class:compact>
	<!-- Header -->
	<div class="flex items-center gap-2 mb-3">
		<h3 class="text-sm font-semibold">PNP Profile Tester</h3>
		<div class="badge badge-neutral badge-sm">
			{activeFeatures.size} feature{activeFeatures.size !== 1 ? 's' : ''}
		</div>
	</div>

	<!-- Preset Selector and Search Row -->
	<div class="grid grid-cols-1 {compact ? '' : 'md:grid-cols-2'} gap-2 mb-3">
		<!-- Preset Selector -->
		<div class="form-control">
			<label for="preset-selector" class="label label-text text-xs font-semibold py-1">
				Example Profiles
			</label>
			<select
				id="preset-selector"
				class="select select-sm select-bordered w-full"
				value={selectedPreset || ''}
				aria-label="Select an example accessibility profile"
				onchange={(e) => {
					const value = (e.target as HTMLSelectElement).value;
					if (value === 'default') {
						activeFeatures = new Set(DEFAULT_ALL_TOOLS_PROFILE);
						selectedPreset = 'default';
						statusMessage = `Default profile applied. ${activeFeatures.size} features enabled.`;
					} else if (value === '') {
						clearAll();
					} else {
						applyPreset(value);
					}
				}}
			>
				<option value="default">Default - All Tools</option>
				<option value="">None (Clear All)</option>
				<optgroup label="Example Profiles">
					{#each Object.entries(EXAMPLE_PNP_CONFIGURATIONS) as [key, preset]}
						<option value={key}>{preset.label.replace('Example: ', '')}</option>
					{/each}
				</optgroup>
			</select>
		</div>

		<!-- Search -->
		{#if !compact}
			<div class="form-control">
				<label for="feature-search" class="label label-text text-xs font-semibold py-1">
					Search Features
				</label>
				<input
					id="feature-search"
					type="text"
					placeholder="Search features..."
					class="input input-bordered input-sm w-full"
					bind:value={searchQuery}
					aria-label="Search accessibility features by name or ID"
				/>
			</div>
		{/if}
	</div>

	<!-- Category Filter -->
	{#if !compact}
		<div class="mb-3">
			<div class="text-xs font-semibold mb-2">Filter by Category</div>
			<div class="flex flex-wrap gap-1">
				<button
					class="btn btn-xs"
					class:btn-primary={showCategoryFilter === null}
					aria-pressed={showCategoryFilter === null}
					onclick={() => (showCategoryFilter = null)}
				>
					All
				</button>
				{#each categories as category}
					<button
						class="btn btn-xs"
						class:btn-primary={showCategoryFilter === category}
						aria-pressed={showCategoryFilter === category}
						onclick={() =>
							(showCategoryFilter = showCategoryFilter === category ? null : category)}
					>
						{category}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Feature Toggles -->
	<div class="border border-base-300 rounded-lg p-3 mb-3 bg-base-100">
		<div class="text-xs font-semibold mb-2">
			Standard Features
			{#if filteredFeatures.length !== allStandardFeatures.length}
				<span class="text-base-content/60 font-normal">
					(showing {filteredFeatures.length} of {allStandardFeatures.length})
				</span>
			{/if}
		</div>
		<div class="max-h-80 overflow-y-auto space-y-0.5 pr-2">
			{#each filteredFeatures as feature}
				<label class="flex items-center gap-2 cursor-pointer hover:bg-base-200 p-2 rounded transition-colors">
					<input
						type="checkbox"
						class="checkbox checkbox-sm"
						checked={activeFeatures.has(feature.id)}
						onchange={() => toggleFeature(feature.id)}
					/>
					<span class="text-sm flex-1">{feature.name}</span>
					{#if !compact}
						<span class="badge badge-xs badge-ghost">{feature.category}</span>
					{/if}
				</label>
			{/each}
			{#if filteredFeatures.length === 0}
				<div class="text-center text-sm text-base-content/60 py-4">
					No features match your search
				</div>
			{/if}
		</div>
	</div>

	<!-- Custom Features -->
	{#if allowCustomFeatures}
		<div class="border border-base-300 rounded-lg p-3 mb-3 bg-base-100">
			<div class="text-xs font-semibold mb-2">Custom Features</div>
			<div class="flex gap-2 mb-2">
				<label for="custom-feature-input" class="sr-only">Custom feature ID</label>
				<input
					id="custom-feature-input"
					type="text"
					placeholder="e.g., ext:custom-feature"
					class="input input-bordered input-sm flex-1"
					bind:value={customFeature}
					aria-label="Enter custom feature ID"
					onkeydown={(e) => e.key === 'Enter' && addCustomFeature()}
				/>
				<button class="btn btn-sm btn-primary" onclick={addCustomFeature}> Add </button>
			</div>

			{#if Array.from(activeFeatures).some((f) => !allStandardFeatures.find((sf) => sf.id === f))}
				<div class="space-y-1 mt-2">
					{#each Array.from(activeFeatures).filter((f) => !allStandardFeatures.find((sf) => sf.id === f)) as feature}
						<div
							class="flex items-center gap-2 text-sm bg-warning/10 p-2 rounded border border-warning/20"
						>
							<span class="flex-1 font-mono text-xs">{feature}</span>
							<button
								class="btn btn-xs btn-circle btn-ghost"
								onclick={() => toggleFeature(feature)}
								aria-label="Remove custom feature {feature}"
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-xs text-base-content/60 mt-2">
					Add non-standard QTI features for testing
				</div>
			{/if}
		</div>
	{/if}

	<!-- Active Features Summary -->
	{#if !compact && activeFeatures.size > 0}
		<details class="mt-3">
			<summary class="cursor-pointer text-xs font-semibold text-base-content/70">
				Active Features ({activeFeatures.size})
			</summary>
			<div class="mt-2 p-2 bg-base-200 rounded text-xs">
				<code class="whitespace-pre-wrap">
					{JSON.stringify({ supports: Array.from(activeFeatures) }, null, 2)}
				</code>
			</div>
		</details>
	{/if}

	<!-- Live region for status announcements -->
	<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
		{statusMessage}
	</div>
</div>

<style>
	.pnp-profile-tester {
		font-family: system-ui, -apple-system, sans-serif;
	}

	.pnp-profile-tester.compact {
		font-size: 0.875rem;
	}

	/* Custom scrollbar for feature list */
	.pnp-profile-tester .max-h-80::-webkit-scrollbar {
		width: 8px;
	}

	.pnp-profile-tester .max-h-80::-webkit-scrollbar-track {
		background: transparent;
	}

	.pnp-profile-tester .max-h-80::-webkit-scrollbar-thumb {
		background: hsl(var(--bc) / 0.2);
		border-radius: 4px;
	}

	.pnp-profile-tester .max-h-80::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--bc) / 0.3);
	}

	/* Firefox scrollbar */
	.pnp-profile-tester .max-h-80 {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--bc) / 0.2) transparent;
	}

	/* Improve form control spacing */
	.pnp-profile-tester .form-control .label {
		padding-top: 0.25rem;
		padding-bottom: 0.25rem;
	}
</style>
