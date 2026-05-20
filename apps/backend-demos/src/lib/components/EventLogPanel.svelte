<script lang="ts">
	type EventLogEntry = {
		at: string;
		type: string;
		detail: unknown;
	};

	interface Props {
		entries: EventLogEntry[];
	}

	let { entries }: Props = $props();
</script>

<div class="p-4">
	{#if entries.length === 0}
		<p class="text-sm text-base-content/60">No events recorded yet.</p>
	{:else}
		<div class="grid gap-4">
			{#each entries as entry}
				<article class="rounded-box border border-base-300 p-4">
					<header class="mb-2 flex flex-wrap items-baseline gap-3">
						<time class="text-sm text-base-content/60">{entry.at}</time>
						<strong class="badge badge-secondary badge-outline">{entry.type}</strong>
					</header>
					<pre
						class="rounded-box bg-neutral p-4 text-xs text-neutral-content"
						aria-label={`Event detail for ${entry.type} at ${entry.at}`}
					>{JSON.stringify(entry.detail, null, 2)}</pre>
				</article>
			{/each}
		</div>
	{/if}
</div>
