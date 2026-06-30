<script lang="ts">
	import JsonInspectPanel from "./JsonInspectPanel.svelte";

	type BackendTrafficEntry = {
		id: number;
		at: string;
		operation: string;
		method: string;
		url: string;
		status?: number;
		durationMs?: number;
		request: unknown;
		response?: unknown;
		error?: string;
	};

	interface Props {
		entries: BackendTrafficEntry[];
	}

	let { entries }: Props = $props();
	const newestEntryId = $derived(entries[0]?.id ?? null);

	const operationLabel: Record<string, string> = {
		load: "Load item + session",
		model: "Process model",
		saveSession: "Persist session",
		score: "Server score",
	};
</script>

<div class="grid gap-4 p-4">
	<header class="grid gap-1">
		<h3 class="text-sm font-semibold">Backend HTTP traffic</h3>
		<p class="text-sm text-base-content/70">
			Shows the exact delivery endpoints the player calls, with request and response
			payloads. This is the host integration contract; storage details are deliberately
			not emphasized here.
		</p>
	</header>

	{#if entries.length === 0}
		<p class="rounded-box border border-dashed border-base-300 p-4 text-sm text-base-content/60">
			No backend calls recorded yet. Load, change an answer, save, or score to see
			the traffic.
		</p>
	{:else}
		<ol class="grid gap-4" aria-label="Recorded backend traffic">
			{#each entries as entry (entry.id)}
				<li
					class={`backend-traffic-entry rounded-box border border-base-300 bg-base-100 ${
						entry.id === newestEntryId ? "backend-traffic-entry--latest" : ""
					}`}
				>
					<article>
						<header class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-4 py-3">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="badge badge-primary badge-outline">
										{operationLabel[entry.operation] ?? entry.operation}
									</span>
									<strong class="font-mono text-sm">
										{entry.method} {entry.url}
									</strong>
								</div>
								<p class="mt-1 text-xs text-base-content/60">
									{entry.at}
									{#if typeof entry.durationMs === "number"}
										<span aria-hidden="true"> · </span>{entry.durationMs}ms
									{/if}
								</p>
							</div>
							{#if entry.error}
								<span class="badge badge-error">error</span>
							{:else if entry.status}
								<span
									class={`badge ${
										entry.status >= 200 && entry.status < 300
											? "badge-success"
											: "badge-warning"
									}`}
								>
									HTTP {entry.status}
								</span>
							{/if}
						</header>

						<div class="grid gap-3 p-4 xl:grid-cols-2">
							<section class="rounded-box border border-base-300">
								<header class="border-b border-base-300 px-3 py-2">
									<h4 class="text-xs font-bold uppercase tracking-wide text-base-content/70">
										Request
									</h4>
								</header>
								<JsonInspectPanel
									value={entry.request}
									description=""
									ariaLabel={`Request payload for ${entry.method} ${entry.url}`}
								/>
							</section>

							<section class="rounded-box border border-base-300">
								<header class="border-b border-base-300 px-3 py-2">
									<h4 class="text-xs font-bold uppercase tracking-wide text-base-content/70">
										Response
									</h4>
								</header>
								<JsonInspectPanel
									value={entry.error ? { error: entry.error } : entry.response}
									description=""
									ariaLabel={`Response payload for ${entry.method} ${entry.url}`}
								/>
							</section>
						</div>
					</article>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.backend-traffic-entry {
		position: relative;
		overflow: hidden;
		transform-origin: top center;
	}

	.backend-traffic-entry--latest {
		animation:
			backend-traffic-entry-in 180ms ease-out,
			backend-traffic-entry-pulse 1200ms ease-out;
	}

	@keyframes backend-traffic-entry-in {
		from {
			opacity: 0;
			transform: translateY(-0.35rem);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes backend-traffic-entry-pulse {
		0% {
			background-color: color-mix(
				in oklab,
				var(--color-primary, currentColor) 18%,
				transparent
			);
			box-shadow: 0 0 0 2px
				color-mix(in oklab, var(--color-primary, currentColor) 42%, transparent);
		}

		100% {
			background-color: transparent;
			box-shadow: 0 0 0 0 transparent;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.backend-traffic-entry--latest {
			animation: none;
		}
	}
</style>
