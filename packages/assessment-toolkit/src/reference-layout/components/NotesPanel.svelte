<script lang="ts">
	import { onMount } from "svelte";

	let {
		itemId,
		itemLabel,
		onClose,
	}: {
		itemId: string;
		itemLabel?: string;
		onClose?: () => void;
	} = $props();

	let text = $state("");
	let status = $state<"idle" | "saved">("idle");

	function storageKey(id: string) {
		return `schoolcity-notes:${id || "unknown"}`;
	}

	function load() {
		if (!itemId) {
			text = "";
			return;
		}
		try {
			const v = localStorage.getItem(storageKey(itemId));
			text = v ?? "";
		} catch {
			// ignore
		}
	}

	function save() {
		if (!itemId) return;
		try {
			localStorage.setItem(storageKey(itemId), text);
			status = "saved";
			window.setTimeout(() => {
				status = "idle";
			}, 800);
		} catch {
			// ignore
		}
	}

	$effect(() => {
		// reload when item changes
		load();
	});

	onMount(() => {
		load();
	});
</script>

<div class="notes-panel">
	<div class="notes-header">
		<div class="notes-title">
			<span class="title">Notes</span>
			{#if itemLabel}
				<span class="subtitle">{itemLabel}</span>
			{/if}
		</div>
		<button class="icon-button" onclick={() => onClose?.()} aria-label="Close notes">
			×
		</button>
	</div>

	<div class="notes-body">
		<textarea
			class="notes-textarea"
			bind:value={text}
			placeholder="Write notes for this question..."
			onblur={save}
		></textarea>
	</div>

	<div class="notes-footer">
		<button class="save-button" onclick={save}>
			Save Note
		</button>
		{#if status === "saved"}
			<span class="saved">Saved</span>
		{/if}
	</div>
</div>

<style>
	.notes-panel {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100%;
		border-left: 1px solid var(--pie-border, #e0e0e0);
		background-color: var(--pie-background, #ffffff);
	}

	.notes-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.75rem 0.5rem;
		border-bottom: 1px solid var(--pie-border, #e0e0e0);
	}

	.notes-title {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.title {
		font-weight: 600;
		font-size: 0.95rem;
		color: var(--pie-text, #000);
	}

	.subtitle {
		font-size: 0.8rem;
		color: var(--pie-text-secondary, #666);
	}

	.icon-button {
		border: 1px solid var(--pie-border, #e0e0e0);
		background: transparent;
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
	}

	.icon-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.notes-body {
		padding: 0.75rem;
		min-height: 0;
	}

	.notes-textarea {
		width: 100%;
		height: 100%;
		resize: none;
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 6px;
		padding: 0.5rem;
		font-size: 0.875rem;
		font-family: inherit;
	}

	.notes-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem 0.75rem;
		border-top: 1px solid var(--pie-border, #e0e0e0);
	}

	.save-button {
		padding: 0.5rem 0.75rem;
		background-color: var(--pie-background, #ffffff);
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.save-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.saved {
		font-size: 0.8rem;
		color: var(--pie-text-secondary, #666);
	}
</style>

