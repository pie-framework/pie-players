<script lang="ts">
	import { getAllDemos } from '$lib/content/demos';

	const demos = getAllDemos();
	const elementCount = new Set(demos.map((demo) => demo.sourcePackage)).size;
	const groupedDemos = Array.from(
		demos.reduce((groups, demo) => {
			const existing = groups.get(demo.sourcePackage) ?? [];
			existing.push(demo);
			groups.set(demo.sourcePackage, existing);
			return groups;
		}, new Map<string, typeof demos>()),
	).map(([sourcePackage, packageDemos]) => ({
		sourcePackage,
		label: sourcePackage
			.split('-')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' '),
		demos: packageDemos,
	}));
</script>

<svelte:head>
	<title>PIE Item Player - React Demo Catalog</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<header class="mb-12 space-y-4">
		<div class="badge badge-secondary badge-outline">IIFE Catalog</div>
		<h1 class="text-5xl font-bold">PIE Item Player React Demos</h1>
		<p class="text-xl text-base-content/70 max-w-3xl">
			Imported from the current `pie-elements-ng` React demo set so each element can be exercised
			through the unified item player using `@latest` bundle-service packages.
		</p>
		<div class="stats stats-vertical lg:stats-horizontal shadow bg-base-100">
			<div class="stat">
				<div class="stat-title">Demo Variants</div>
				<div class="stat-value text-primary">{demos.length}</div>
			</div>
			<div class="stat">
				<div class="stat-title">React Elements</div>
				<div class="stat-value">{elementCount}</div>
			</div>
			<div class="stat">
				<div class="stat-title">Player Mode</div>
				<div class="stat-value text-secondary text-2xl">IIFE</div>
			</div>
		</div>
	</header>

	<div class="space-y-12">
		{#each groupedDemos as group}
			<section class="space-y-5">
				<div class="flex items-end justify-between gap-4 border-b border-base-300 pb-3">
					<div>
						<h2 class="text-3xl font-bold">{group.label}</h2>
						<p class="text-base-content/60">
							{group.demos.length} demo{group.demos.length === 1 ? '' : 's'}
						</p>
					</div>
					<div class="badge badge-outline">{group.sourcePackage}</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
					{#each group.demos as demo}
						<a
							href={`/demo/${demo.id}/delivery?player=iife`}
							class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
						>
							<div class="card-body gap-4">
								<div class="flex items-start justify-between gap-3">
									<h3 class="card-title text-2xl leading-tight">{demo.name}</h3>
									<div class="badge badge-secondary badge-outline whitespace-nowrap">
										{demo.sourceVariantId}
									</div>
								</div>
								<p class="text-base-content/70">{demo.description}</p>
								{#if demo.tags.length}
									<div class="flex flex-wrap gap-2">
										{#each demo.tags.slice(0, 4) as tag}
											<span class="badge badge-ghost">{tag}</span>
										{/each}
										{#if demo.tags.length > 4}
											<span class="badge badge-ghost">+{demo.tags.length - 4} more</span>
										{/if}
									</div>
								{/if}
								<div class="card-actions justify-between items-center pt-2">
									<span class="text-sm text-base-content/50">{demo.id}</span>
									<span class="btn btn-primary">Open Demo &#8594;</span>
								</div>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>
