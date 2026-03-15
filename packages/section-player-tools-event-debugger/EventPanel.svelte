<svelte:options
	customElement={{
		tag: "pie-section-player-tools-event-debugger",
		shadow: "open",
		props: {
			maxEvents: { type: "Number", attribute: "max-events" },
			toolkitCoordinator: { type: "Object", attribute: "toolkit-coordinator" },
			sectionId: { type: "String", attribute: "section-id" },
			attemptId: { type: "String", attribute: "attempt-id" },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-theme/components.css";
	import SharedFloatingPanel from "@pie-players/pie-section-player-tools-shared/SharedFloatingPanel.svelte";
	import {
		getSectionControllerFromCoordinator,
		isMatchingSectionControllerLifecycleEvent,
	} from "@pie-players/pie-section-player-tools-shared";
	import { createEventDispatcher, onDestroy, untrack } from "svelte";

	type ControllerEvent = {
		type?: string;
		timestamp?: number;
		itemId?: string;
		canonicalItemId?: string;
		intent?: string;
		[key: string]: unknown;
	};
	type ControllerRuntimeState = {
		loadingComplete?: boolean;
		totalRegistered?: number;
		totalLoaded?: number;
		itemsComplete?: boolean;
		completedCount?: number;
		totalItems?: number;
	} | null;
	type ToolkitCoordinatorLike = {
		subscribeItemEvents?: (args: {
			sectionId: string;
			attemptId?: string;
			listener: (event: ControllerEvent) => void;
		}) => () => void;
		subscribeSectionLifecycleEvents?: (args: {
			sectionId: string;
			attemptId?: string;
			listener: (event: ControllerEvent) => void;
		}) => () => void;
		getSectionController?: (args: {
			sectionId: string;
			attemptId?: string;
		}) => unknown;
		onSectionControllerLifecycle?: (
			listener: (event: {
				key?: { sectionId?: string; attemptId?: string };
			}) => void,
		) => () => void;
	};

	type EventType =
		| "item-session-data-changed"
		| "item-session-meta-changed"
		| "item-selected"
		| "section-navigation-change"
		| "content-loaded"
		| "item-player-error"
		| "item-complete-changed"
		| "section-loading-complete"
		| "section-items-complete-changed"
		| "section-error";
	type EventLevel = "item" | "section";

	type EventRecord = {
		id: number;
		type: EventType;
		timestamp: number;
		targetTag: string | null;
		itemId: string | null;
		canonicalItemId: string | null;
		intent: string | null;
		duplicateCount: number;
		payload: unknown;
		fingerprint: string;
		semanticFingerprint: string;
	};

	const dispatch = createEventDispatcher<{ close: undefined }>();

	let {
		maxEvents = 200,
		toolkitCoordinator = null,
		sectionId = "",
		attemptId = undefined,
	}: {
		maxEvents?: number;
		toolkitCoordinator?: ToolkitCoordinatorLike | null;
		sectionId?: string;
		attemptId?: string;
	} = $props();
	let isPaused = $state(false);
	let selectedLevel = $state<EventLevel>("item");
	let selectedRecordId = $state<number | null>(null);
	let records = $state<EventRecord[]>([]);
	let controllerAvailable = $state(false);

	let nextRecordId = 1;
	let resubscribeQueued = false;
	const subscriptions: {
		controller: (() => void) | null;
		lifecycle: (() => void) | null;
		activeSectionId: string;
		activeAttemptId?: string;
	} = {
		controller: null,
		lifecycle: null,
		activeSectionId: "",
		activeAttemptId: undefined,
	};

	function safeClone<T>(value: T): T {
		try {
			return structuredClone(value);
		} catch {
			try {
				return JSON.parse(JSON.stringify(value)) as T;
			} catch {
				return value;
			}
		}
	}

	function createFingerprint(type: EventType, payload: unknown): string {
		let payloadString = "";
		try {
			payloadString = JSON.stringify(payload);
		} catch {
			payloadString = String(payload);
		}
		return `${type}:${payloadString}`;
	}

	function createSemanticFingerprint(type: EventType, payload: unknown): string {
		const semantic =
			payload && typeof payload === "object"
				? { ...(payload as Record<string, unknown>) }
				: payload;
		if (semantic && typeof semantic === "object") {
			delete (semantic as Record<string, unknown>).timestamp;
			delete (semantic as Record<string, unknown>).sourceRuntimeId;
		}
		let payloadString = "";
		try {
			payloadString = JSON.stringify(semantic);
		} catch {
			payloadString = String(semantic);
		}
		return `${type}:${payloadString}`;
	}

	function normalizeEventType(input: unknown): EventType | null {
		const value = String(input || "");
		if (
			value === "item-session-data-changed" ||
			value === "item-session-meta-changed" ||
			value === "item-selected" ||
			value === "section-navigation-change" ||
			value === "content-loaded" ||
			value === "item-player-error" ||
			value === "item-complete-changed" ||
			value === "section-loading-complete" ||
			value === "section-items-complete-changed" ||
			value === "section-error"
		) {
			return value;
		}
		return null;
	}

	function getEventLevel(type: EventType): EventLevel {
		if (
			type === "section-navigation-change" ||
			type === "section-loading-complete" ||
			type === "section-items-complete-changed" ||
			type === "section-error"
		) {
			return "section";
		}
		return "item";
	}

	function getValueAsString(value: unknown): string | null {
		return typeof value === "string" && value.trim() ? value : null;
	}

	function normalizeRecord(detail: ControllerEvent, type: EventType): EventRecord {
		const payload = safeClone((detail || {}) as unknown);
		const fingerprint = createFingerprint(type, payload);
		const semanticFingerprint = createSemanticFingerprint(type, payload);
		return {
			id: nextRecordId++,
			type,
			timestamp: typeof detail.timestamp === "number" ? detail.timestamp : Date.now(),
			targetTag: "section-controller",
			itemId: getValueAsString(detail?.itemId),
			canonicalItemId: getValueAsString(detail?.canonicalItemId),
			intent: getValueAsString(detail?.intent),
			duplicateCount: 1,
			payload,
			fingerprint,
			semanticFingerprint,
		};
	}

	function pushRecord(detail: ControllerEvent) {
		if (isPaused) return;
		const type = normalizeEventType(detail?.type);
		if (!type) return;
		const next = normalizeRecord(detail, type);
		const latest = records[0];
		if (latest && latest.fingerprint === next.fingerprint) {
			records = [
				{
					...latest,
					timestamp: next.timestamp,
					duplicateCount: latest.duplicateCount + 1,
				},
				...records.slice(1),
			];
			return;
		}
		const cappedMaxEvents = Math.max(10, Math.min(2000, maxEvents || 200));
		records = [next, ...records].slice(0, cappedMaxEvents);
		if (selectedRecordId == null) {
			selectedRecordId = next.id;
		}
	}

	function handleControllerEvent(event: ControllerEvent): void {
		pushRecord(event || {});
	}

	function handleItemControllerEvent(event: ControllerEvent): void {
		handleControllerEvent(event);
	}

	function handleSectionControllerEvent(event: ControllerEvent): void {
		handleControllerEvent(event);
	}

	function getController(): any | null {
		return getSectionControllerFromCoordinator(
			toolkitCoordinator,
			sectionId,
			attemptId,
		);
	}

	function seedFromRuntimeState(controller: {
		getRuntimeState?: () => ControllerRuntimeState;
	}): void {
		const runtimeState = controller?.getRuntimeState?.();
		if (!runtimeState || typeof runtimeState !== "object") return;
		const totalItems =
			typeof runtimeState.totalItems === "number" ? runtimeState.totalItems : 0;
		const now = Date.now();
		pushRecord({
			type: "section-items-complete-changed",
			complete: runtimeState.itemsComplete === true,
			completedCount:
				typeof runtimeState.completedCount === "number"
					? runtimeState.completedCount
					: 0,
			totalItems,
			timestamp: now,
		});
		if (runtimeState.loadingComplete === true) {
			pushRecord({
				type: "section-loading-complete",
				totalRegistered:
					typeof runtimeState.totalRegistered === "number"
						? runtimeState.totalRegistered
						: 0,
				totalLoaded:
					typeof runtimeState.totalLoaded === "number"
						? runtimeState.totalLoaded
						: 0,
				timestamp: now,
			});
		}
	}

	function detachControllerSubscription() {
		subscriptions.controller?.();
		subscriptions.controller = null;
		subscriptions.activeSectionId = "";
		subscriptions.activeAttemptId = undefined;
	}

	function detachLifecycleSubscription() {
		subscriptions.lifecycle?.();
		subscriptions.lifecycle = null;
	}

	function ensureControllerSubscription() {
		const controller = getController();
		controllerAvailable = Boolean(controller);
		if (!controller) {
			detachControllerSubscription();
			return;
		}

		const nextAttemptId = attemptId || undefined;
		const isSameTarget =
			subscriptions.activeSectionId === sectionId &&
			subscriptions.activeAttemptId === nextAttemptId;
		if (isSameTarget && subscriptions.controller) {
			return;
		}

		detachControllerSubscription();
		const unsubscribeItem =
			toolkitCoordinator?.subscribeItemEvents?.({
				sectionId,
				attemptId,
				listener: handleItemControllerEvent,
			}) || null;
		const unsubscribeSection =
			toolkitCoordinator?.subscribeSectionLifecycleEvents?.({
				sectionId,
				attemptId,
				listener: handleSectionControllerEvent,
			}) || null;
		subscriptions.controller = () => {
			unsubscribeItem?.();
			unsubscribeSection?.();
		};
		subscriptions.activeSectionId = sectionId;
		subscriptions.activeAttemptId = nextAttemptId;
		seedFromRuntimeState(controller);
	}

	function queueEnsureControllerSubscription(): void {
		if (resubscribeQueued) return;
		resubscribeQueued = true;
		queueMicrotask(() => {
			resubscribeQueued = false;
			ensureControllerSubscription();
		});
	}

	function clearRecords() {
		records = [];
		selectedRecordId = null;
	}

	function formatTimestamp(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}

	const visibleRecords = $derived.by(() =>
		records.filter(
			(record) => getEventLevel(record.type) === selectedLevel,
		),
	);
	const semanticCounts = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const record of visibleRecords) {
			counts.set(
				record.semanticFingerprint,
				(counts.get(record.semanticFingerprint) || 0) + record.duplicateCount,
			);
		}
		return counts;
	});
	const selectedRecord = $derived.by(
		() => visibleRecords.find((record) => record.id === selectedRecordId) || visibleRecords[0] || null,
	);

	$effect(() => {
		void toolkitCoordinator;
		void sectionId;
		void attemptId;
		untrack(() => {
			ensureControllerSubscription();
			detachLifecycleSubscription();
			subscriptions.lifecycle = toolkitCoordinator?.onSectionControllerLifecycle?.(
				(event: {
					type?: "ready" | "disposed";
					key?: { sectionId?: string; attemptId?: string };
				}) => {
					if (
						!isMatchingSectionControllerLifecycleEvent(event, sectionId, attemptId)
					)
						return;
					if (event?.type === "disposed") {
						detachControllerSubscription();
						queueEnsureControllerSubscription();
						return;
					}
					const nextAttemptId = attemptId || undefined;
					if (
						subscriptions.controller &&
						subscriptions.activeSectionId === sectionId &&
						subscriptions.activeAttemptId === nextAttemptId
					) {
						return;
					}
					queueEnsureControllerSubscription();
				},
			) || null;
		});
		return () => {
			detachControllerSubscription();
			detachLifecycleSubscription();
		};
	});

	onDestroy(() => {
		detachControllerSubscription();
		detachLifecycleSubscription();
	});
</script>

<SharedFloatingPanel
	title="Controller Events"
	ariaLabel="Drag event debugger panel"
	minWidth={360}
	minHeight={280}
	initialSizing={{
		widthRatio: 0.34,
		heightRatio: 0.74,
		minWidth: 380,
		maxWidth: 720,
		minHeight: 360,
		maxHeight: 860,
		alignX: "right",
		alignY: "center",
		paddingX: 16,
		paddingY: 16,
	}}
	className="pie-section-player-tools-event-debugger"
	bodyClass="pie-section-player-tools-event-debugger__content-shell"
	onClose={() => dispatch("close")}
>
	<svelte:fragment slot="icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-event-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-7 7h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
			</svg>
	</svelte:fragment>

	<div class="pie-section-player-tools-event-debugger__toolbar">
		<div
			class="pie-section-player-tools-event-debugger__toggle-group"
			role="group"
			aria-label="Event level filter"
		>
			<button
				class="pie-section-player-tools-event-debugger__toggle-button"
				class:pie-section-player-tools-event-debugger__toggle-button--active={selectedLevel ===
					"item"}
				onclick={() => (selectedLevel = "item")}
				aria-pressed={selectedLevel === "item"}
			>
				item
			</button>
			<button
				class="pie-section-player-tools-event-debugger__toggle-button"
				class:pie-section-player-tools-event-debugger__toggle-button--active={selectedLevel ===
					"section"}
				onclick={() => (selectedLevel = "section")}
				aria-pressed={selectedLevel === "section"}
			>
				section
			</button>
		</div>
		<button class="pie-section-player-tools-event-debugger__button" onclick={() => (isPaused = !isPaused)}>
			{isPaused ? "resume" : "pause"}
		</button>
		<button class="pie-section-player-tools-event-debugger__button" onclick={clearRecords}>
			clear
		</button>
		{#if !controllerAvailable}
			<span class="pie-section-player-tools-event-debugger__status">
				controller unavailable
			</span>
		{/if}
	</div>

	<div class="pie-section-player-tools-event-debugger__grid">
		<div class="pie-section-player-tools-event-debugger__list">
			{#if visibleRecords.length === 0}
				<div class="pie-section-player-tools-event-debugger__empty">
					No matching events yet. Interact with an item to capture controller events.
				</div>
			{:else}
				{#each visibleRecords as record (record.id)}
					<button
						class="pie-section-player-tools-event-debugger__row"
						class:pie-section-player-tools-event-debugger__row--active={selectedRecord?.id ===
							record.id}
						onclick={() => (selectedRecordId = record.id)}
					>
						<div class="pie-section-player-tools-event-debugger__row-top">
							<span class="pie-section-player-tools-event-debugger__event-type">{record.type}</span>
							<span class="pie-section-player-tools-event-debugger__event-time">
								{formatTimestamp(record.timestamp)}
							</span>
						</div>
						<div class="pie-section-player-tools-event-debugger__row-meta">
							{#if record.itemId}
								<span>item: {record.itemId}</span>
							{/if}
							{#if record.intent}
								<span>intent: {record.intent}</span>
							{/if}
							{#if (semanticCounts.get(record.semanticFingerprint) || 0) > record.duplicateCount}
								<span>
									semantic repeats: {semanticCounts.get(record.semanticFingerprint)}
								</span>
							{/if}
							{#if record.duplicateCount > 1}
								<span>dupes: {record.duplicateCount}</span>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>
		<div class="pie-section-player-tools-event-debugger__detail">
			{#if selectedRecord}
				<div class="pie-section-player-tools-event-debugger__detail-meta">
					<div><strong>Type:</strong> {selectedRecord.type}</div>
					<div><strong>Target:</strong> {selectedRecord.targetTag || "unknown"}</div>
					<div><strong>Item:</strong> {selectedRecord.itemId || "n/a"}</div>
					<div><strong>Canonical:</strong> {selectedRecord.canonicalItemId || "n/a"}</div>
					<div><strong>Intent:</strong> {selectedRecord.intent || "n/a"}</div>
					<div><strong>Duplicates:</strong> {selectedRecord.duplicateCount}</div>
					<div>
						<strong>Semantic Repeats:</strong>
						{semanticCounts.get(selectedRecord.semanticFingerprint) || selectedRecord.duplicateCount}
					</div>
				</div>
				<pre class="pie-section-player-tools-event-debugger__pre">{JSON.stringify(
					selectedRecord.payload,
					null,
					2,
				)}</pre>
			{:else}
				<div class="pie-section-player-tools-event-debugger__empty">
					Select an event to inspect payload details.
				</div>
			{/if}
		</div>
	</div>
</SharedFloatingPanel>

<style>
	.pie-section-player-tools-event-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-event-debugger__toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
		flex-wrap: wrap;
	}

	.pie-section-player-tools-event-debugger__button {
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-100, #fff);
		color: inherit;
		border-radius: 6px;
		font-size: 0.78rem;
		padding: 6px 8px;
	}

	.pie-section-player-tools-event-debugger__toggle-group {
		display: inline-flex;
		border: 1px solid var(--color-base-300, #d1d5db);
		border-radius: 6px;
		overflow: hidden;
	}

	.pie-section-player-tools-event-debugger__toggle-button {
		border: none;
		background: var(--color-base-100, #fff);
		color: inherit;
		font-size: 0.78rem;
		padding: 6px 10px;
		cursor: pointer;
	}

	.pie-section-player-tools-event-debugger__toggle-button + .pie-section-player-tools-event-debugger__toggle-button {
		border-left: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-event-debugger__toggle-button--active {
		background: color-mix(in srgb, var(--color-primary, #2563eb) 18%, transparent);
		font-weight: 600;
	}

	.pie-section-player-tools-event-debugger__status {
		font-size: 0.72rem;
		opacity: 0.75;
	}

	.pie-section-player-tools-event-debugger__grid {
		display: grid;
		grid-template-columns: minmax(180px, 1fr) minmax(260px, 1.3fr);
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-event-debugger__list {
		border-right: 1px solid var(--color-base-300, #d1d5db);
		overflow: auto;
	}

	.pie-section-player-tools-event-debugger__detail {
		overflow: auto;
	}

	.pie-section-player-tools-event-debugger__row {
		display: block;
		width: 100%;
		border: 0;
		text-align: left;
		background: transparent;
		padding: 8px 10px;
		border-bottom: 1px solid var(--color-base-300, #e5e7eb);
		cursor: pointer;
	}

	.pie-section-player-tools-event-debugger__row--active {
		background: color-mix(in srgb, var(--color-primary, #2563eb) 14%, transparent);
	}

	.pie-section-player-tools-event-debugger__row-top {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 0.74rem;
	}

	.pie-section-player-tools-event-debugger__event-type {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-weight: 600;
	}

	.pie-section-player-tools-event-debugger__event-time {
		opacity: 0.75;
	}

	.pie-section-player-tools-event-debugger__row-meta {
		margin-top: 4px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		font-size: 0.7rem;
		opacity: 0.88;
	}

	.pie-section-player-tools-event-debugger__detail-meta {
		display: grid;
		gap: 3px;
		padding: 10px 12px;
		font-size: 0.78rem;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-event-debugger__pre {
		margin: 0;
		padding: 12px;
		font-size: 0.74rem;
		line-height: 1.35;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}

	.pie-section-player-tools-event-debugger__empty {
		padding: 12px;
		font-size: 0.8rem;
		opacity: 0.8;
	}

</style>
