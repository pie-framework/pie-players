<script lang="ts">
	/**
	 * Example usage of PNPProfileTester component
	 *
	 * This demonstrates how to use the PNP Profile Tester for development and testing.
	 * Shows integration with PNPToolResolver and PNPProvenanceViewer.
	 */
	import PNPProfileTester from './PNPProfileTester.svelte';
	import PNPProvenanceViewer from './PNPProvenanceViewer.svelte';
	import { PNPToolResolver } from '../services/PNPToolResolver.js';
	import { createDefaultToolRegistry } from '../services/createDefaultToolRegistry.js';
	import type { PersonalNeedsProfile } from '@pie-players/pie-players-shared/types';
	import type { PNPResolutionProvenance } from '../services/pnp-provenance.js';

	// Mock assessment for testing
	const mockAssessment = {
		id: 'test-assessment-1',
		name: 'Example Assessment',
		personalNeedsProfile: undefined as PersonalNeedsProfile | undefined,
		settings: {
			// Example district policy
			districtPolicy: {
				blockedTools: [], // No blocks in this example
				requiredTools: [], // No requirements in this example
			},
		},
	};

	// Create resolver with default tool registry
	const toolRegistry = createDefaultToolRegistry();
	const resolver = new PNPToolResolver(toolRegistry, true);

	// State
	let currentProfile = $state<PersonalNeedsProfile | null>(null);
	let resolutionResult = $state<{
		toolIds: string[];
		provenance: PNPResolutionProvenance;
	} | null>(null);
	let showProvenance = $state(true);

	// Update resolution when profile changes
	function handleProfileChange(profile: PersonalNeedsProfile | null) {
		currentProfile = profile;

		// Use the override method to test with this profile
		const result = resolver.resolveWithOverride(mockAssessment as any, profile);

		resolutionResult = {
			toolIds: result.tools.filter((t) => t.enabled).map((t) => t.id),
			provenance: result.provenance,
		};
	}
</script>

<div class="container mx-auto p-4 max-w-6xl">
	<div class="prose mb-6">
		<h1>PNP Profile Tester - Example</h1>
		<p>
			This component allows developers and testers to experiment with different PNP
			(Personal Needs Profile) configurations in real-time.
		</p>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Left: Profile Tester -->
		<div>
			<PNPProfileTester onProfileChange={handleProfileChange} />
		</div>

		<!-- Right: Resolution Results -->
		<div class="space-y-4">
			<!-- Enabled Tools -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h3 class="card-title text-sm">Resolved Tools</h3>
					{#if resolutionResult && resolutionResult.toolIds.length > 0}
						<div class="space-y-2">
							{#each resolutionResult.toolIds as toolId}
								<div class="badge badge-primary">{toolId}</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-base-content/50">
							No tools enabled. Select a profile or add features to see results.
						</p>
					{/if}
				</div>
			</div>

			<!-- Profile JSON -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h3 class="card-title text-sm">Current Profile JSON</h3>
					<div class="mockup-code">
						<pre><code>{JSON.stringify(currentProfile, null, 2)}</code></pre>
					</div>
				</div>
			</div>

			<!-- Provenance Toggle -->
			<div class="form-control">
				<label class="label cursor-pointer">
					<span class="label-text">Show Provenance</span>
					<input
						type="checkbox"
						class="toggle toggle-primary"
						bind:checked={showProvenance}
					/>
				</label>
			</div>
		</div>
	</div>

	<!-- Full-width Provenance Viewer -->
	{#if showProvenance && resolutionResult}
		<div class="mt-6">
			<PNPProvenanceViewer provenance={resolutionResult.provenance} />
		</div>
	{/if}

	<!-- Usage Examples -->
	<div class="prose mt-8">
		<h2>Integration Examples</h2>

		<h3>Basic Usage</h3>
		<pre><code>{`<script>
  import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';

  let currentProfile;
</script>

<PNPProfileTester
  onProfileChange={(profile) => {
    currentProfile = profile;
    // Apply to your assessment player
  }}
/>`}</code></pre>

		<h3>With PNPToolResolver Override</h3>
		<pre><code>{`<script>
  import { PNPProfileTester } from '@pie-players/pie-assessment-toolkit/components';
  import { PNPToolResolver, createDefaultToolRegistry } from '@pie-players/pie-assessment-toolkit';

  const registry = createDefaultToolRegistry();
  const resolver = new PNPToolResolver(registry);

  function handleProfileChange(profile) {
    // Test with override profile
    const result = resolver.resolveWithOverride(assessment, profile);

    // Use resolved tools
    const toolIds = result.tools.filter(t => t.enabled).map(t => t.id);

    // Show provenance
    console.log(result.provenance);
  }
</script>

<PNPProfileTester onProfileChange={handleProfileChange} />`}</code></pre>

		<h3>Compact Mode in Sidebar</h3>
		<pre><code>{`<PNPProfileTester compact={true} onProfileChange={handleProfileChange} />`}</code></pre>

		<h3>Without Custom Features</h3>
		<pre><code>{`<PNPProfileTester
  allowCustomFeatures={false}
  onProfileChange={handleProfileChange}
/>`}</code></pre>
	</div>
</div>

<style>
	.prose {
		max-width: 100%;
	}

	.prose code {
		background-color: hsl(var(--b2));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}

	.prose pre code {
		background-color: transparent;
		padding: 0;
	}
</style>
