<script lang="ts">
	interface Props {
		value: unknown;
		description?: string;
		testId?: string;
		ariaLabel?: string;
	}

	let {
		value,
		description = "",
		testId = "",
		ariaLabel = "Formatted JSON output",
	}: Props = $props();

	const formattedJson = $derived(JSON.stringify(value ?? null, null, 2));

	function copyJson(): void {
		if (typeof navigator === "undefined") return;
		void navigator.clipboard.writeText(formattedJson);
	}
</script>

<div class="grid gap-3 p-4">
	<div class="flex items-start justify-between gap-3">
		{#if description}
			<p class="text-sm text-base-content/70">{description}</p>
		{/if}
		<button
			type="button"
			class="btn btn-xs btn-outline"
			onclick={copyJson}
			title="Copy JSON to clipboard"
		>
			Copy
		</button>
	</div>
	<pre
		class="rounded-box bg-neutral p-4 text-xs text-neutral-content"
		data-testid={testId || undefined}
		aria-label={ariaLabel}
	>{formattedJson}</pre>
</div>
