<svelte:options
	customElement={{
		tag: "pie-section-player-tools-instrumentation-debugger",
		shadow: "open",
		props: {
			maxRecords: { type: "Number", attribute: "max-records" },
			maxRecordsByKind: {
				type: "Object",
				attribute: "max-records-by-kind",
			},
			persistenceScope: { type: "String", attribute: "persistence-scope" },
			persistencePanelId: { type: "String", attribute: "persistence-panel-id" },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-theme/components.css";
	import {
		clearBufferedInstrumentationDebugRecords,
		subscribeInstrumentationDebugRecords,
		type InstrumentationDebugRecord,
	} from "@pie-players/pie-players-shared";
	import SharedFloatingPanel from "@pie-players/pie-section-player-tools-shared/SharedFloatingPanel.svelte";
	import { createEventDispatcher, onDestroy } from "svelte";

	const dispatch = createEventDispatcher<{ close: undefined }>();
	const allowedKinds = new Set([
		"event",
		"error",
		"metric",
		"user-context",
		"global-attributes",
	]);
	type RecordKind = InstrumentationDebugRecord["kind"];
	type RecordLimitOverrides = Partial<Record<RecordKind, number>>;

	let {
		maxRecords = 250,
		maxRecordsByKind = {},
		persistenceScope = "",
		persistencePanelId = "instrumentation-events",
	}: {
		maxRecords?: number;
		maxRecordsByKind?: RecordLimitOverrides;
		persistenceScope?: string;
		persistencePanelId?: string;
	} = $props();
	let isPaused = $state(false);
	let selectedKind = $state<InstrumentationDebugRecord["kind"] | "all">("all");
	let selectedRecordId = $state<number | null>(null);
	let records = $state<InstrumentationDebugRecord[]>([]);

	function resolveCap(rawCap: unknown, fallback: number): number {
		const parsed = Number(rawCap);
		if (!Number.isFinite(parsed)) return Math.max(20, Math.min(2000, fallback));
		return Math.max(20, Math.min(2000, parsed));
	}

	function getCapForKind(kind: RecordKind): number {
		const globalCap = resolveCap(maxRecords || 250, 250);
		const override = maxRecordsByKind?.[kind];
		return resolveCap(override, globalCap);
	}

	function toTimestampValue(timestamp: string): number {
		const parsed = Date.parse(timestamp);
		return Number.isNaN(parsed) ? 0 : parsed;
	}

	function pruneAndSortRecords(
		nextRecords: InstrumentationDebugRecord[],
	): InstrumentationDebugRecord[] {
		const sorted = [...nextRecords].sort((left, right) => {
			const leftTs = toTimestampValue(left.timestamp);
			const rightTs = toTimestampValue(right.timestamp);
			if (leftTs === rightTs) {
				return right.id - left.id;
			}
			return rightTs - leftTs;
		});
		const nextByKind: Record<RecordKind, number> = {
			event: 0,
			error: 0,
			metric: 0,
			"user-context": 0,
			"global-attributes": 0,
		};
		const pruned: InstrumentationDebugRecord[] = [];
		for (const record of sorted) {
			const kindCap = getCapForKind(record.kind);
			if (nextByKind[record.kind] >= kindCap) continue;
			pruned.push(record);
			nextByKind[record.kind] += 1;
		}
		return pruned;
	}

	function reconcileRecordsWithLimits(): void {
		const nextRecords = pruneAndSortRecords(records);
		if (nextRecords.length !== records.length) {
			records = nextRecords;
			return;
		}
		for (let index = 0; index < nextRecords.length; index += 1) {
			if (nextRecords[index]?.id !== records[index]?.id) {
				records = nextRecords;
				return;
			}
		}
	}

	const unsubscribe = subscribeInstrumentationDebugRecords({
		listener: (record) => {
			if (isPaused) return;
			records = pruneAndSortRecords([record, ...records]);
			if (selectedRecordId == null) selectedRecordId = record.id;
		},
		replayBuffered: true,
	});

	onDestroy(() => {
		unsubscribe();
	});

	function formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return timestamp;
		return date.toLocaleTimeString();
	}

	function setSelectedKind(nextKind: string): void {
		if (nextKind === "all") {
			selectedKind = "all";
			return;
		}
		if (allowedKinds.has(nextKind)) {
			selectedKind = nextKind as InstrumentationDebugRecord["kind"];
		}
	}

	function clearRecords(): void {
		records = [];
		selectedRecordId = null;
		clearBufferedInstrumentationDebugRecords();
	}

	$effect(() => {
		void maxRecords;
		void maxRecordsByKind;
		reconcileRecordsWithLimits();
	});

	const visibleRecords = $derived.by(() =>
		records.filter(
			(record) => selectedKind === "all" || record.kind === selectedKind,
		),
	);
	const selectedRecord = $derived.by(
		() =>
			visibleRecords.find((record) => record.id === selectedRecordId) ||
			visibleRecords[0] ||
			null,
	);
</script>

<SharedFloatingPanel
	title="Instrumentation"
	ariaLabel="Drag instrumentation panel"
	minWidth={360}
	minHeight={320}
	{persistenceScope}
	{persistencePanelId}
	initialSizing={{
		widthRatio: 0.35,
		heightRatio: 0.74,
		minWidth: 380,
		maxWidth: 760,
		minHeight: 380,
		maxHeight: 900,
		alignX: "right",
		alignY: "center",
		paddingX: 20,
		paddingY: 24,
	}}
	className="pie-section-player-tools-instrumentation-debugger"
	bodyClass="pie-section-player-tools-instrumentation-debugger__content-shell"
	onClose={() => dispatch("close")}
>
	<svelte:fragment slot="icon">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="pie-section-player-tools-instrumentation-debugger__icon-sm"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 13h4l2 6 4-14 2 8h4"
			/>
		</svg>
	</svelte:fragment>

	<div class="pie-section-player-tools-instrumentation-debugger__toolbar">
		<select
			class="pie-section-player-tools-instrumentation-debugger__kind-select"
			value={selectedKind}
			onchange={(event) =>
				setSelectedKind((event.currentTarget as HTMLSelectElement).value)}
			aria-label="Filter instrumentation record type"
		>
			<option value="all">all</option>
			<option value="event">event</option>
			<option value="error">error</option>
			<option value="metric">metric</option>
			<option value="user-context">user-context</option>
			<option value="global-attributes">global-attributes</option>
		</select>
		<button
			class="pie-section-player-tools-instrumentation-debugger__button"
			onclick={() => (isPaused = !isPaused)}
		>
			{isPaused ? "resume" : "pause"}
		</button>
		<button
			class="pie-section-player-tools-instrumentation-debugger__button"
			onclick={clearRecords}
		>
			clear
		</button>
	</div>

	<div class="pie-section-player-tools-instrumentation-debugger__grid">
		<div class="pie-section-player-tools-instrumentation-debugger__list">
			{#if visibleRecords.length === 0}
				<div class="pie-section-player-tools-instrumentation-debugger__empty">
					No instrumentation records yet.
				</div>
			{:else}
				{#each visibleRecords as record (record.id)}
					<button
						class="pie-section-player-tools-instrumentation-debugger__row"
						class:pie-section-player-tools-instrumentation-debugger__row--active={selectedRecord?.id ===
							record.id}
						onclick={() => (selectedRecordId = record.id)}
					>
						<div class="pie-section-player-tools-instrumentation-debugger__row-top">
							<span class="pie-section-player-tools-instrumentation-debugger__record-name">
								{record.name}
							</span>
							<span class="pie-section-player-tools-instrumentation-debugger__record-time">
								{formatTimestamp(record.timestamp)}
							</span>
						</div>
						<div class="pie-section-player-tools-instrumentation-debugger__row-meta">
							<span>{record.kind}</span>
							<span>{record.providerId}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
		<div class="pie-section-player-tools-instrumentation-debugger__detail">
			{#if selectedRecord}
				<div class="pie-section-player-tools-instrumentation-debugger__detail-meta">
					<div><strong>name:</strong> {selectedRecord.name}</div>
					<div><strong>kind:</strong> {selectedRecord.kind}</div>
					<div><strong>provider:</strong> {selectedRecord.providerName}</div>
					<div><strong>timestamp:</strong> {selectedRecord.timestamp}</div>
					{#if selectedRecord.value !== undefined}
						<div><strong>value:</strong> {selectedRecord.value}</div>
					{/if}
					{#if selectedRecord.errorMessage}
						<div>
							<strong>error:</strong>
							{selectedRecord.errorMessage}
						</div>
					{/if}
				</div>
				<pre class="pie-section-player-tools-instrumentation-debugger__pre">{JSON.stringify(
					selectedRecord.attributes ?? {},
					null,
					2,
				)}</pre>
			{:else}
				<div class="pie-section-player-tools-instrumentation-debugger__empty">
					Select a record to inspect details.
				</div>
			{/if}
		</div>
	</div>
</SharedFloatingPanel>

<style>
	.pie-section-player-tools-instrumentation-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-instrumentation-debugger__toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
		flex-wrap: wrap;
	}

	.pie-section-player-tools-instrumentation-debugger__kind-select,
	.pie-section-player-tools-instrumentation-debugger__button {
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-100, #fff);
		color: inherit;
		border-radius: 6px;
		font-size: 0.78rem;
		padding: 6px 8px;
	}

	.pie-section-player-tools-instrumentation-debugger__grid {
		display: grid;
		grid-template-columns: minmax(210px, 1fr) minmax(280px, 1.3fr);
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-instrumentation-debugger__list {
		border-right: 1px solid var(--color-base-300, #d1d5db);
		overflow: auto;
	}

	.pie-section-player-tools-instrumentation-debugger__detail {
		overflow: auto;
	}

	.pie-section-player-tools-instrumentation-debugger__row {
		display: block;
		width: 100%;
		border: 0;
		text-align: left;
		background: transparent;
		padding: 8px 10px;
		border-bottom: 1px solid var(--color-base-300, #e5e7eb);
		cursor: pointer;
	}

	.pie-section-player-tools-instrumentation-debugger__row--active {
		background: color-mix(in srgb, var(--color-primary, #2563eb) 14%, transparent);
	}

	.pie-section-player-tools-instrumentation-debugger__row-top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.74rem;
	}

	.pie-section-player-tools-instrumentation-debugger__record-name {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-weight: 600;
	}

	.pie-section-player-tools-instrumentation-debugger__record-time {
		opacity: 0.75;
	}

	.pie-section-player-tools-instrumentation-debugger__row-meta {
		margin-top: 4px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.7rem;
		opacity: 0.88;
	}

	.pie-section-player-tools-instrumentation-debugger__detail-meta {
		display: grid;
		gap: 3px;
		padding: 10px 12px;
		font-size: 0.78rem;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-instrumentation-debugger__pre {
		margin: 0;
		padding: 12px;
		font-size: 0.74rem;
		line-height: 1.35;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.pie-section-player-tools-instrumentation-debugger__empty {
		padding: 12px;
		font-size: 0.8rem;
		opacity: 0.8;
	}
</style>
