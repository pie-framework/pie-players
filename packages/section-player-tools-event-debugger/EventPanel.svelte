<svelte:options
	customElement={{
		tag: "pie-section-player-tools-event-debugger",
		shadow: "none",
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
	import { createEventDispatcher, onDestroy, onMount } from "svelte";

	type ControllerEvent = {
		type?: string;
		timestamp?: number;
		itemId?: string;
		canonicalItemId?: string;
		intent?: string;
		replayed?: boolean;
		[key: string]: unknown;
	};

	type EventType =
		| "item-session-data-changed"
		| "item-session-meta-changed"
		| "item-selected"
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
		replayed: boolean;
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
		toolkitCoordinator?: any;
		sectionId?: string;
		attemptId?: string;
	} = $props();
	let panelX = $state(380);
	let panelY = $state(100);
	let panelWidth = $state(500);
	let panelHeight = $state(620);
	let isMinimized = $state(false);
	let isPaused = $state(false);
	let selectedLevel = $state<EventLevel>("item");
	let selectedRecordId = $state<number | null>(null);
	let records = $state<EventRecord[]>([]);
	let controllerAvailable = $state(false);

	let isDragging = false;
	let isResizing = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartPanelX = 0;
	let dragStartPanelY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;
	let nextRecordId = 1;
	let activeController: {
		subscribe?: (listener: (event: ControllerEvent) => void) => () => void;
	} | null = null;
	let unsubscribeController: (() => void) | null = null;
	let unsubscribeLifecycle: (() => void) | null = null;

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
			replayed: detail?.replayed === true,
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

	function getController(): any | null {
		if (!toolkitCoordinator || !sectionId) return null;
		return (
			toolkitCoordinator.getSectionController?.({
				sectionId,
				attemptId,
			}) || null
		);
	}

	function detachControllerSubscription() {
		unsubscribeController?.();
		unsubscribeController = null;
		activeController = null;
	}

	function detachLifecycleSubscription() {
		unsubscribeLifecycle?.();
		unsubscribeLifecycle = null;
	}

	function ensureControllerSubscription() {
		const controller = getController();
		controllerAvailable = Boolean(controller);
		if (!controller) {
			detachControllerSubscription();
			return;
		}
		if (controller === activeController) return;
		detachControllerSubscription();
		activeController = controller;
		unsubscribeController =
			controller.subscribe?.((event: ControllerEvent) => {
				pushRecord(event || {});
			}) || null;
	}

	function startDrag(event: MouseEvent) {
		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragStartPanelX = panelX;
		dragStartPanelY = panelY;
		document.addEventListener("mousemove", onDrag);
		document.addEventListener("mouseup", stopDrag);
	}

	function onDrag(event: MouseEvent) {
		if (!isDragging) return;
		const deltaX = event.clientX - dragStartX;
		const deltaY = event.clientY - dragStartY;
		panelX = Math.max(0, Math.min(dragStartPanelX + deltaX, window.innerWidth - panelWidth));
		panelY = Math.max(0, Math.min(dragStartPanelY + deltaY, window.innerHeight - 100));
	}

	function stopDrag() {
		isDragging = false;
		document.removeEventListener("mousemove", onDrag);
		document.removeEventListener("mouseup", stopDrag);
	}

	function startResize(event: MouseEvent) {
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = panelWidth;
		resizeStartHeight = panelHeight;
		document.addEventListener("mousemove", onResize);
		document.addEventListener("mouseup", stopResize);
		event.preventDefault();
		event.stopPropagation();
	}

	function onResize(event: MouseEvent) {
		if (!isResizing) return;
		const deltaX = event.clientX - resizeStartX;
		const deltaY = event.clientY - resizeStartY;
		panelWidth = Math.max(340, Math.min(resizeStartWidth + deltaX, window.innerWidth - panelX));
		panelHeight = Math.max(260, Math.min(resizeStartHeight + deltaY, window.innerHeight - panelY));
	}

	function stopResize() {
		isResizing = false;
		document.removeEventListener("mousemove", onResize);
		document.removeEventListener("mouseup", stopResize);
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

	onMount(() => {
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		panelWidth = clamp(Math.round(viewportWidth * 0.34), 380, 720);
		panelHeight = clamp(Math.round(viewportHeight * 0.74), 360, 860);
		panelX = Math.max(16, Math.round(viewportWidth * 0.58));
		panelY = Math.max(16, Math.round((viewportHeight - panelHeight) / 2));
		ensureControllerSubscription();
		unsubscribeLifecycle = toolkitCoordinator?.onSectionControllerLifecycle?.(
			(event: { key?: { sectionId?: string; attemptId?: string } }) => {
				const eventSectionId = event?.key?.sectionId || "";
				const eventAttemptId = event?.key?.attemptId || undefined;
				if (eventSectionId !== sectionId) return;
				if ((eventAttemptId || undefined) !== (attemptId || undefined)) return;
				ensureControllerSubscription();
			},
		);

		return () => {
			detachControllerSubscription();
			detachLifecycleSubscription();
		};
	});

	$effect(() => {
		void toolkitCoordinator;
		void sectionId;
		void attemptId;
		ensureControllerSubscription();
		detachLifecycleSubscription();
		unsubscribeLifecycle = toolkitCoordinator?.onSectionControllerLifecycle?.(
			(event: { key?: { sectionId?: string; attemptId?: string } }) => {
				const eventSectionId = event?.key?.sectionId || "";
				const eventAttemptId = event?.key?.attemptId || undefined;
				if (eventSectionId !== sectionId) return;
				if ((eventAttemptId || undefined) !== (attemptId || undefined)) return;
				ensureControllerSubscription();
			},
		);
		return () => {
			detachLifecycleSubscription();
		};
	});

	onDestroy(() => {
		stopDrag();
		stopResize();
		detachControllerSubscription();
		detachLifecycleSubscription();
	});
</script>

<div
	class="pie-section-player-tools-event-debugger"
	style="left: {panelX}px; top: {panelY}px; width: {panelWidth}px; {isMinimized ? 'height: auto;' : `height: ${panelHeight}px;`}"
>
	<div
		class="pie-section-player-tools-event-debugger__header"
		onmousedown={startDrag}
		role="button"
		tabindex="0"
		aria-label="Drag event debugger panel"
	>
		<div class="pie-section-player-tools-event-debugger__header-title">
			<h3 class="pie-section-player-tools-event-debugger__title">Session Broadcasts</h3>
			<span class="pie-section-player-tools-event-debugger__counter">{records.length}</span>
		</div>
		<div class="pie-section-player-tools-event-debugger__header-actions">
			<button
				class="pie-section-player-tools-event-debugger__icon-button"
				onclick={() => (isMinimized = !isMinimized)}
				title={isMinimized ? "Maximize" : "Minimize"}
			>
				{isMinimized ? "▴" : "▾"}
			</button>
			<button
				class="pie-section-player-tools-event-debugger__icon-button"
				onclick={() => dispatch("close")}
				title="Close"
			>
				✕
			</button>
		</div>
	</div>

	{#if !isMinimized}
		<div class="pie-section-player-tools-event-debugger__content-shell" style="height: {panelHeight - 56}px;">
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
							No matching events yet. Interact with an item to capture broadcasts.
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
									{#if record.replayed}
										<span>replayed</span>
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
							<div><strong>Replayed:</strong> {selectedRecord.replayed ? "yes" : "no"}</div>
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
		</div>
	{/if}

	{#if !isMinimized}
		<div
			class="pie-section-player-tools-event-debugger__resize-handle"
			onmousedown={startResize}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			◢
		</div>
	{/if}
</div>

<style>
	.pie-section-player-tools-event-debugger {
		position: fixed;
		z-index: 9999;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 1px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-section-player-tools-event-debugger__header {
		height: 56px;
		padding: 0 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
	}

	.pie-section-player-tools-event-debugger__header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-section-player-tools-event-debugger__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-section-player-tools-event-debugger__counter {
		font-size: 0.75rem;
		padding: 2px 7px;
		border-radius: 999px;
		background: var(--color-primary, #2563eb);
		color: white;
	}

	.pie-section-player-tools-event-debugger__header-actions {
		display: flex;
		gap: 6px;
	}

	.pie-section-player-tools-event-debugger__icon-button {
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-100, #fff);
		border-radius: 6px;
		font-size: 0.8rem;
		padding: 4px 7px;
		cursor: pointer;
	}

	.pie-section-player-tools-event-debugger__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
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

	.pie-section-player-tools-event-debugger__resize-handle {
		position: absolute;
		right: 6px;
		bottom: 4px;
		cursor: nwse-resize;
		user-select: none;
		font-size: 0.9rem;
		opacity: 0.7;
	}
</style>
