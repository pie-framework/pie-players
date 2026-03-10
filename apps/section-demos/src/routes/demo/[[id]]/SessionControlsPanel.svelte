<script lang="ts">
	type SectionSessionStateLike = {
		currentItemIndex?: number;
		visitedItemIdentifiers?: string[];
		itemSessions?: Record<string, unknown>;
	} | null;

	interface Props {
		sectionId: string;
		attemptId: string;
		itemIds: string[];
		sessionSnapshot: SectionSessionStateLike;
		persistenceStorageKey: string | null;
		persistenceStoragePresent: boolean;
		lastSavedAt: number | null;
		lastRestoredAt: number | null;
		lastHostUpdateAt: number | null;
		lastRefreshAt: number | null;
		onRefresh: () => void | Promise<void>;
		onPersistNow: () => void | Promise<void>;
		onHydrateNow: () => void | Promise<void>;
		onApplySessionSnapshot: (
			snapshot: Record<string, unknown>,
			mode: "replace" | "merge",
		) => void | Promise<void>;
		onUpdateItemSession: (
			itemId: string,
			detail: Record<string, unknown>,
		) => void | Promise<void>;
		onClose: () => void;
	}

	let {
		sectionId,
		attemptId,
		itemIds = [],
		sessionSnapshot = null,
		persistenceStorageKey = null,
		persistenceStoragePresent = false,
		lastSavedAt = null,
		lastRestoredAt = null,
		lastHostUpdateAt = null,
		lastRefreshAt = null,
		onRefresh,
		onPersistNow,
		onHydrateNow,
		onApplySessionSnapshot,
		onUpdateItemSession,
		onClose,
	}: Props = $props();

	let sessionSnapshotDraft = $state("{}");
	let selectedItemId = $state("");
	let selectedChoiceValue = $state("a");
	let statusMessage = $state("");
	let statusLevel = $state<"info" | "error">("info");

	function formatTimestamp(value: number | null): string {
		if (!value) return "n/a";
		return new Date(value).toLocaleTimeString();
	}

	function setStatus(message: string, level: "info" | "error" = "info"): void {
		statusMessage = message;
		statusLevel = level;
	}

	async function runWithStatus(
		message: string,
		work: () => Promise<void> | void,
	): Promise<void> {
		try {
			await work();
			setStatus(message, "info");
		} catch (error) {
			setStatus(
				error instanceof Error ? error.message : "Session control action failed.",
				"error",
			);
		}
	}

	async function applySnapshot(mode: "replace" | "merge"): Promise<void> {
		await runWithStatus(`Applied ${mode} snapshot from host.`, async () => {
			const parsed = JSON.parse(sessionSnapshotDraft) as Record<string, unknown>;
			await onApplySessionSnapshot(parsed, mode);
		});
	}

	async function applyHostItemUpdate(): Promise<void> {
		if (!selectedItemId) {
			setStatus("Choose an item identifier first.", "error");
			return;
		}
		await runWithStatus(`Updated session for ${selectedItemId} from host.`, async () => {
			await onUpdateItemSession(selectedItemId, {
				choiceValue: selectedChoiceValue,
			});
		});
	}

	$effect(() => {
		const nextItemId = itemIds[0] || "";
		if (!selectedItemId) {
			selectedItemId = nextItemId;
		}
	});

	$effect(() => {
		sessionSnapshotDraft = JSON.stringify(sessionSnapshot || { itemSessions: {} }, null, 2);
	});
</script>

<aside class="pie-demo-session-controls" aria-label="Session controls panel">
	<div class="pie-demo-session-controls__header">
		<h3 class="pie-demo-session-controls__title">Session Controls</h3>
		<button
			type="button"
			class="pie-demo-session-controls__close"
			onclick={onClose}
			aria-label="Close session controls panel"
		>
			✕
		</button>
	</div>

	<p class="pie-demo-session-controls__intro">
		Host-owned session controls: mutate section session outside PIE item elements and watch item UI update automatically.
	</p>

	<div class="pie-demo-session-controls__meta">
		<div><strong>sectionId:</strong> <code>{sectionId}</code></div>
		<div><strong>attemptId:</strong> <code>{attemptId}</code></div>
		<div><strong>persist key:</strong> <code>{persistenceStorageKey || "n/a"}</code></div>
		<div><strong>persist key present:</strong> {persistenceStoragePresent ? "yes" : "no"}</div>
		<div><strong>last saved:</strong> {formatTimestamp(lastSavedAt)}</div>
		<div><strong>last restored:</strong> {formatTimestamp(lastRestoredAt)}</div>
		<div><strong>last host update:</strong> {formatTimestamp(lastHostUpdateAt)}</div>
		<div><strong>last refresh:</strong> {formatTimestamp(lastRefreshAt)}</div>
	</div>

	<div class="pie-demo-session-controls__actions">
		<button type="button" class="pie-demo-session-controls__button" onclick={() => runWithStatus("Refreshed controller session.", onRefresh)}>Refresh</button>
		<button type="button" class="pie-demo-session-controls__button" onclick={() => runWithStatus("Persisted session via strategy.", onPersistNow)}>Persist</button>
		<button type="button" class="pie-demo-session-controls__button" onclick={() => runWithStatus("Hydrated session via strategy.", onHydrateNow)}>Hydrate</button>
	</div>

	<label class="pie-demo-session-controls__label" for="pie-demo-session-snapshot">
		Session snapshot JSON
	</label>
	<textarea
		id="pie-demo-session-snapshot"
		class="pie-demo-session-controls__snapshot"
		bind:value={sessionSnapshotDraft}
		spellcheck="false"
	></textarea>

	<div class="pie-demo-session-controls__actions">
		<button type="button" class="pie-demo-session-controls__button" onclick={() => applySnapshot("replace")}>Apply replace</button>
		<button type="button" class="pie-demo-session-controls__button" onclick={() => applySnapshot("merge")}>Apply merge</button>
	</div>

	<div class="pie-demo-session-controls__row">
		<label class="pie-demo-session-controls__label" for="pie-demo-session-item-id">Item</label>
		<select
			id="pie-demo-session-item-id"
			class="pie-demo-session-controls__select"
			bind:value={selectedItemId}
		>
			{#each itemIds as itemId}
				<option value={itemId}>{itemId}</option>
			{/each}
		</select>
	</div>

	<div class="pie-demo-session-controls__row">
		<label class="pie-demo-session-controls__label" for="pie-demo-session-choice">Choice value</label>
		<select
			id="pie-demo-session-choice"
			class="pie-demo-session-controls__select"
			bind:value={selectedChoiceValue}
		>
			<option value="a">a</option>
			<option value="b">b</option>
			<option value="c">c</option>
			<option value="d">d</option>
		</select>
	</div>

	<button
		type="button"
		class="pie-demo-session-controls__button pie-demo-session-controls__button--primary"
		onclick={applyHostItemUpdate}
	>
		Update item session from host
	</button>

	{#if statusMessage}
		<div
			class={`pie-demo-session-controls__status ${
				statusLevel === "error"
					? "pie-demo-session-controls__status--error"
					: "pie-demo-session-controls__status--info"
			}`}
		>
			{statusMessage}
		</div>
	{/if}
</aside>

<style>
	.pie-demo-session-controls {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		width: min(32rem, calc(100vw - 2rem));
		max-height: min(80vh, 48rem);
		overflow: auto;
		background: var(--color-base-100);
		color: var(--color-base-content);
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		border-radius: 0.5rem;
		padding: 0.85rem;
		box-shadow: 0 0.75rem 2rem color-mix(in srgb, black 25%, transparent);
		z-index: 9998;
		font-size: 0.82rem;
	}

	.pie-demo-session-controls__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.pie-demo-session-controls__title {
		margin: 0;
		font-size: 0.92rem;
		font-weight: 700;
	}

	.pie-demo-session-controls__close {
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		background: var(--color-base-100);
		color: var(--color-base-content);
		border-radius: 0.25rem;
		cursor: pointer;
		line-height: 1;
		padding: 0.2rem 0.35rem;
	}

	.pie-demo-session-controls__intro {
		margin: 0 0 0.5rem;
		opacity: 0.84;
	}

	.pie-demo-session-controls__meta {
		display: grid;
		gap: 0.2rem;
		margin-bottom: 0.6rem;
	}

	.pie-demo-session-controls__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.55rem;
	}

	.pie-demo-session-controls__button {
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		background: var(--color-base-100);
		color: var(--color-base-content);
		border-radius: 0.3rem;
		padding: 0.3rem 0.55rem;
		cursor: pointer;
	}

	.pie-demo-session-controls__button--primary {
		background: color-mix(in srgb, var(--color-primary) 18%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-base-300));
	}

	.pie-demo-session-controls__label {
		display: block;
		font-weight: 600;
		margin: 0.25rem 0;
	}

	.pie-demo-session-controls__snapshot {
		width: 100%;
		min-height: 9rem;
		resize: vertical;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		border-radius: 0.3rem;
		padding: 0.45rem;
		background: color-mix(in srgb, var(--color-base-200) 65%, white);
		color: var(--color-base-content);
		box-sizing: border-box;
		margin-bottom: 0.5rem;
	}

	.pie-demo-session-controls__row {
		display: grid;
		gap: 0.25rem;
		margin-bottom: 0.45rem;
	}

	.pie-demo-session-controls__select {
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		border-radius: 0.3rem;
		padding: 0.25rem 0.35rem;
		background: var(--color-base-100);
		color: var(--color-base-content);
	}

	.pie-demo-session-controls__status {
		margin-top: 0.55rem;
		padding: 0.4rem 0.45rem;
		border-radius: 0.3rem;
	}

	.pie-demo-session-controls__status--info {
		background: color-mix(in srgb, var(--color-info) 15%, var(--color-base-100));
		border: 1px solid color-mix(in srgb, var(--color-info) 30%, var(--color-base-300));
	}

	.pie-demo-session-controls__status--error {
		background: color-mix(in srgb, var(--color-error) 12%, var(--color-base-100));
		border: 1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-base-300));
	}
</style>
