<script lang="ts">
	import type { PNPResolutionProvenance } from '../services/pnp-provenance.js';

	// PNP Provenance Viewer Component
	// Visualizes how PNP resolution decisions were made.

	interface Props {
		provenance: PNPResolutionProvenance;
		compact?: boolean;
	}

	let { provenance, compact = false }: Props = $props();

	let features = $derived(Array.from(provenance.features.values()));
	let enabledFeatures = $derived(features.filter((f) => f.finalState === 'enabled'));
	let blockedFeatures = $derived(features.filter((f) => f.finalState === 'blocked'));

	function getRuleBadgeClass(rule: string): string {
		const classes: Record<string, string> = {
			'district-block': 'badge-error',
			'test-admin-override': 'badge-warning',
			'item-restriction': 'badge-info',
			'item-requirement': 'badge-success',
			'district-requirement': 'badge-success',
			'pnp-support': 'badge-primary',
			'system-default': 'badge-ghost'
		};
		return classes[rule] || 'badge-ghost';
	}

	function getActionIcon(action: string): string {
		const icons: Record<string, string> = {
			enable: '✓',
			block: '✗',
			skip: '○'
		};
		return icons[action] || '?';
	}

	function getSourceName(source: unknown): string | undefined {
		if (!source || typeof source !== 'object') return undefined;
		if ('name' in source && typeof (source as any).name === 'string') {
			return (source as any).name;
		}
		if ('title' in source && typeof (source as any).title === 'string') {
			return (source as any).title;
		}
		return undefined;
	}
</script>

<div class="pnp-provenance-viewer" class:compact>
	<!-- Summary -->
	<div class="card bg-base-100 shadow-sm mb-4">
		<div class="card-body">
			<h3 class="card-title text-sm">Resolution Summary</h3>
			<div class="stats stats-vertical lg:stats-horizontal shadow">
				<div class="stat">
					<div class="stat-title">Total Features</div>
					<div class="stat-value text-2xl">{provenance.summary.totalFeatures}</div>
				</div>
				<div class="stat">
					<div class="stat-title">Enabled</div>
					<div class="stat-value text-2xl text-success">{provenance.summary.enabled}</div>
				</div>
				<div class="stat">
					<div class="stat-title">Blocked</div>
					<div class="stat-value text-2xl text-error">{provenance.summary.blocked}</div>
				</div>
			</div>

			<div class="text-xs text-base-content/70 mt-2">
				Resolved at: {provenance.resolvedAt.toLocaleString()}
			</div>
		</div>
	</div>

	<!-- Configuration Sources -->
	{#if !compact}
		<div class="card bg-base-100 shadow-sm mb-4">
			<div class="card-body">
				<h3 class="card-title text-sm">Configuration Sources</h3>
				<div class="space-y-2">
					{#each Object.entries(provenance.sources) as [type, source]}
						<div class="flex items-center gap-2">
							<div class="badge badge-outline">{type}</div>
							<div class="text-sm">
								{getSourceName(source) || source.id}
								<span class="text-xs text-base-content/50">({source.id})</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Feature Resolution -->
	<div class="space-y-4">
		<!-- Enabled Features -->
		{#if enabledFeatures.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h3 class="card-title text-sm text-success">
						Enabled Features ({enabledFeatures.length})
					</h3>
					<div class="space-y-3">
						{#each enabledFeatures as feature}
							<div class="border-l-4 border-success pl-3">
								<div class="flex items-center gap-2 mb-1">
									<code class="text-sm font-semibold">{feature.featureId}</code>
									{#if feature.winningDecision}
										<div class="badge {getRuleBadgeClass(feature.winningDecision.rule)} badge-sm">
											{feature.winningDecision.rule}
										</div>
									{/if}
								</div>

								{#if !compact}
									<div class="text-sm text-base-content/80 whitespace-pre-wrap">
										{feature.explanation}
									</div>
								{:else if feature.winningDecision}
									<div class="text-xs text-base-content/70">
										{feature.winningDecision.reason}
									</div>
								{/if}

								{#if !compact && feature.allDecisions.length > 1}
									<details class="mt-2">
										<summary class="text-xs cursor-pointer text-base-content/60 hover:text-base-content">
											Show all decisions ({feature.allDecisions.length})
										</summary>
										<div class="ml-4 mt-2 space-y-1">
											{#each feature.allDecisions as decision}
												<div class="text-xs flex items-center gap-2">
													<span class="opacity-50">{decision.step}.</span>
													<span class="badge badge-xs {getRuleBadgeClass(decision.rule)}">
														{decision.rule}
													</span>
													<span>{getActionIcon(decision.action)}</span>
													<span class="opacity-70">{decision.reason}</span>
												</div>
											{/each}
										</div>
									</details>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Blocked Features -->
		{#if blockedFeatures.length > 0}
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h3 class="card-title text-sm text-error">
						Blocked Features ({blockedFeatures.length})
					</h3>
					<div class="space-y-3">
						{#each blockedFeatures as feature}
							<div class="border-l-4 border-error pl-3">
								<div class="flex items-center gap-2 mb-1">
									<code class="text-sm font-semibold">{feature.featureId}</code>
									{#if feature.winningDecision}
										<div class="badge {getRuleBadgeClass(feature.winningDecision.rule)} badge-sm">
											{feature.winningDecision.rule}
										</div>
									{/if}
								</div>

								{#if !compact}
									<div class="text-sm text-base-content/80 whitespace-pre-wrap">
										{feature.explanation}
									</div>
								{:else if feature.winningDecision}
									<div class="text-xs text-base-content/70">
										{feature.winningDecision.reason}
									</div>
								{/if}

								{#if !compact && feature.allDecisions.length > 1}
									<details class="mt-2">
										<summary class="text-xs cursor-pointer text-base-content/60 hover:text-base-content">
											Show all decisions ({feature.allDecisions.length})
										</summary>
										<div class="ml-4 mt-2 space-y-1">
											{#each feature.allDecisions as decision}
												<div class="text-xs flex items-center gap-2">
													<span class="opacity-50">{decision.step}.</span>
													<span class="badge badge-xs {getRuleBadgeClass(decision.rule)}">
														{decision.rule}
													</span>
													<span>{getActionIcon(decision.action)}</span>
													<span class="opacity-70">{decision.reason}</span>
												</div>
											{/each}
										</div>
									</details>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Decision Log (collapsed by default) -->
	{#if !compact && provenance.decisionLog.length > 0}
		<details class="mt-4">
			<summary class="cursor-pointer text-sm font-semibold text-base-content/80 hover:text-base-content">
				Complete Decision Log ({provenance.decisionLog.length} steps)
			</summary>
			<div class="card bg-base-100 shadow-sm mt-2">
				<div class="card-body">
					<div class="space-y-2">
						{#each provenance.decisionLog as decision}
							<div class="flex items-start gap-3 text-xs">
								<div class="font-mono text-base-content/50 w-8">
									{decision.step}.
								</div>
								<div class="flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class="badge {getRuleBadgeClass(decision.rule)} badge-sm">
											{decision.rule}
										</span>
										<span class="font-semibold">{decision.featureId}</span>
										<span class={decision.action === 'enable' ? 'text-success' : decision.action === 'block' ? 'text-error' : 'text-base-content/50'}>
											{getActionIcon(decision.action)} {decision.action}
										</span>
									</div>
									<div class="text-base-content/70">
										{decision.reason}
									</div>
									<div class="text-base-content/50 mt-1">
										Source: {getSourceName(decision.source) || decision.source.type}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</details>
	{/if}
</div>

<style>
	.pnp-provenance-viewer {
		font-family: system-ui, -apple-system, sans-serif;
	}

	.pnp-provenance-viewer code {
		background-color: hsl(var(--b2));
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}

	.pnp-provenance-viewer.compact {
		font-size: 0.875rem;
	}

	.pnp-provenance-viewer.compact .card-body {
		padding: 1rem;
	}
</style>
