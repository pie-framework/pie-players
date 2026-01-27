<script lang="ts">
	import { base } from "$app/paths";
	import { ELEMENT_TYPES } from "./element-type-mapping";

	let searchQuery = "";

	$: filteredTypes = ELEMENT_TYPES.filter((type) => {
		const query = searchQuery.toLowerCase();
		return (
			type.name.toLowerCase().includes(query) ||
			type.description.toLowerCase().includes(query)
		);
	});
</script>

<div class="flex-1 flex flex-col overflow-hidden bg-base-100">
	<!-- Hero Section -->
	<div class="bg-gradient-to-r from-primary/10 to-secondary/10 p-8">
		<div class="max-w-4xl mx-auto">
			<h2 class="text-3xl font-bold mb-2">PIE Element Type Preview</h2>
			<p class="text-base-content/70 mb-4">
				Select an element type below to preview with different profiles and
				accommodations. Use the profile editor to simulate various student
				accommodations (IEP, 504, ELL) and the debug panel to inspect events and
				accessibility compliance.
			</p>

			<!-- Search -->
			<div class="form-control">
				<input
					type="text"
					placeholder="Search element types..."
					class="input input-bordered w-full max-w-md"
					bind:value={searchQuery}
				/>
			</div>
		</div>
	</div>

	<!-- Element Type Grid -->
	<div class="flex-1 overflow-y-auto p-8">
		<div class="max-w-6xl mx-auto">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each filteredTypes as type}
					<a
						href="{base}/toolkit-preview/{type.id}"
						class="card bg-base-200 hover:bg-base-300 transition-colors duration-200 cursor-pointer"
					>
						<div class="card-body">
							<div class="flex items-start gap-3">
								<div class="text-4xl">{type.icon}</div>
								<div class="flex-1">
									<h3 class="card-title text-lg">{type.name}</h3>
									<p class="text-sm text-base-content/70 mt-1">
										{type.description}
									</p>
									<div class="badge badge-sm mt-2">
										{type.examples.length}
										{type.examples.length === 1 ? "example" : "examples"}
									</div>
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>

			{#if filteredTypes.length === 0}
				<div class="text-center py-12">
					<p class="text-base-content/60">
						No element types found matching "{searchQuery}"
					</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Quick Stats -->
	<div class="bg-base-200 p-4 border-t border-base-content/10">
		<div class="max-w-6xl mx-auto">
			<div class="stats shadow">
				<div class="stat">
					<div class="stat-title">Total Element Types</div>
					<div class="stat-value text-3xl">{ELEMENT_TYPES.length}</div>
					<div class="stat-desc">Available for testing</div>
				</div>
				<div class="stat">
					<div class="stat-title">Total Examples</div>
					<div class="stat-value text-3xl">
						{ELEMENT_TYPES.reduce((sum, type) => sum + type.examples.length, 0)}
					</div>
					<div class="stat-desc">PIE element instances</div>
				</div>
				<div class="stat">
					<div class="stat-title">Profile Templates</div>
					<div class="stat-value text-3xl">9</div>
					<div class="stat-desc">IEP, 504, and more</div>
				</div>
			</div>
		</div>
	</div>
</div>
