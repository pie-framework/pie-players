<script lang="ts">
	import { onMount } from "svelte";
	import SharedFloatingPanel from "./SharedFloatingPanel.svelte";

	type PanelMode = "section" | "assessment";
	type DbTableName = "attempt_sessions" | "section_sessions" | "item_sessions" | "assessment_sessions";

	interface Props {
		mode?: PanelMode;
		assessmentId: string;
		attemptId: string;
		sectionId?: string;
		apiBasePath?: string;
		onResetDb: () => void | Promise<void>;
		onClose: () => void;
	}

	let {
		mode = "section",
		assessmentId,
		attemptId,
		sectionId = "",
		apiBasePath = "/api/session-demo",
		onResetDb,
		onClose,
	}: Props = $props();

	let pollError = $state<string | null>(null);
	let activeView = $state<"raw-tables" | "reconstructed" | "request-view">("raw-tables");
	let isResettingDb = $state(false);
	let requestViewJson = $state<string>("{}");
	let requestViewError = $state<string | null>(null);
	let isLoadingRequestView = $state(false);
	const POLL_TIMEOUT_MS = 4500;

	let scopedRows = $state<Record<DbTableName, Array<Record<string, unknown>>>>({
		attempt_sessions: [],
		section_sessions: [],
		item_sessions: [],
		assessment_sessions: [],
	});
	let scopedColumns = $state<Record<DbTableName, string[]>>({
		attempt_sessions: [],
		section_sessions: [],
		item_sessions: [],
		assessment_sessions: [],
	});
	let reconstructedSnapshotJson = $state<string>("{}");

	const tableOrder = $derived.by(() =>
		mode === "section"
			? (["attempt_sessions", "section_sessions", "item_sessions"] as DbTableName[])
			: (["attempt_sessions", "assessment_sessions"] as DbTableName[]),
	);

	const viewTitle = $derived.by(() =>
		mode === "section" ? "Show section request" : "Show assessment request",
	);

	function collectColumns(rows: Array<Record<string, unknown>>): string[] {
		const seen = new Set<string>();
		const columns: string[] = [];
		for (const row of rows) {
			for (const key of Object.keys(row)) {
				if (seen.has(key)) continue;
				seen.add(key);
				columns.push(key);
			}
		}
		return columns;
	}

	function formatCellValue(value: unknown): string {
		if (value === null || value === undefined) return "";
		if (typeof value === "object") {
			try {
				return JSON.stringify(value);
			} catch {
				return "[unserializable]";
			}
		}
		return String(value);
	}

	const COLUMN_HEADER_LABELS: Record<string, string> = {
		id: "id",
		assessment_id: "asm_id",
		attempt_id: "att_id",
		demo_user_id: "demo_uid",
		created_at: "created",
		updated_at: "updated",
		attempt_session_id: "att_sess_id",
		section_id: "sec_id",
		current_item_identifier: "curr_item_id",
		visited_item_identifiers: "visited_item_ids",
		section_session_id: "sec_sess_id",
		item_identifier: "item_id",
		canonical_item_id: "canon_item_id",
		session_payload: "payload",
		snapshot_payload: "payload",
	};

	function abbreviateColumnName(column: string): string {
		const explicit = COLUMN_HEADER_LABELS[column];
		if (explicit) return explicit;
		if (column.length <= 14) return column;
		const parts = column.split("_").filter(Boolean);
		if (parts.length <= 1) return column.slice(0, 14);
		const abbreviated = parts
			.map((part, index) => (index === parts.length - 1 ? part.slice(0, 4) : part.slice(0, 3)))
			.join("_");
		return abbreviated.slice(0, 18);
	}

	function scopedSnapshotKey(): string {
		return mode === "section"
			? `${assessmentId}:${sectionId}:${attemptId}`
			: `${assessmentId}:${attemptId}`;
	}

	function applyStatePayload(payload: unknown): void {
		const state = (payload as { state?: Record<string, unknown> } | null)?.state || {};
		const stateTables = (state?.tables as Record<string, unknown> | undefined) || {};

		const attemptRows = Array.isArray(stateTables.attempt_sessions)
			? (stateTables.attempt_sessions as Array<Record<string, unknown>>)
			: [];
		const targetAttemptRows = attemptRows.filter(
			(row) => row.assessment_id === assessmentId && row.attempt_id === attemptId,
		);
		const targetAttemptIds = new Set(
			targetAttemptRows
				.map((row) => row.id)
				.filter((id): id is number => typeof id === "number"),
		);

		const nextRows: Record<DbTableName, Array<Record<string, unknown>>> = {
			attempt_sessions: targetAttemptRows,
			section_sessions: [],
			item_sessions: [],
			assessment_sessions: [],
		};

		if (mode === "section") {
			const sectionRows = Array.isArray(stateTables.section_sessions)
				? (stateTables.section_sessions as Array<Record<string, unknown>>)
				: [];
			const targetSectionRows = sectionRows.filter(
				(row) =>
					targetAttemptIds.has(row.attempt_session_id as number) &&
					row.section_id === sectionId,
			);
			nextRows.section_sessions = targetSectionRows;
			const targetSectionIds = new Set(
				targetSectionRows
					.map((row) => row.id)
					.filter((id): id is number => typeof id === "number"),
			);
			const itemRows = Array.isArray(stateTables.item_sessions)
				? (stateTables.item_sessions as Array<Record<string, unknown>>)
				: [];
			nextRows.item_sessions = itemRows.filter((row) =>
				targetSectionIds.has(row.section_session_id as number),
			);
		} else {
			const assessmentRows = Array.isArray(stateTables.assessment_sessions)
				? (stateTables.assessment_sessions as Array<Record<string, unknown>>)
				: [];
			nextRows.assessment_sessions = assessmentRows.filter((row) =>
				targetAttemptIds.has(row.attempt_session_id as number),
			);
		}

		scopedRows = nextRows;
		scopedColumns = {
			attempt_sessions: collectColumns(nextRows.attempt_sessions),
			section_sessions: collectColumns(nextRows.section_sessions),
			item_sessions: collectColumns(nextRows.item_sessions),
			assessment_sessions: collectColumns(nextRows.assessment_sessions),
		};

		const snapshots =
			(state.reconstructedSnapshots as Record<string, unknown> | undefined) || {};
		const key = scopedSnapshotKey();
		reconstructedSnapshotJson = JSON.stringify(snapshots[key] || {}, null, 2);
	}

	async function handleResetDb(): Promise<void> {
		if (isResettingDb) return;
		isResettingDb = true;
		try {
			await onResetDb();
		} finally {
			isResettingDb = false;
		}
	}

	async function fetchDbStateOnce(): Promise<void> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
		try {
			const response = await fetch(`${apiBasePath}/state`, {
				signal: controller.signal,
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(`DB state request failed (${response.status})`);
			}
			applyStatePayload(await response.json());
			pollError = null;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				pollError = `DB state request timed out after ${POLL_TIMEOUT_MS}ms`;
			} else {
				pollError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async function fetchRequestView(): Promise<void> {
		if (activeView !== "request-view") return;
		isLoadingRequestView = true;
		requestViewError = null;
		const query = new URLSearchParams({
			assessmentId,
			attemptId,
		});
		if (mode === "section" && sectionId) {
			query.set("sectionId", sectionId);
		}
		try {
			const response = await fetch(`${apiBasePath}/activity/load?${query.toString()}`, {
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(`Request view failed (${response.status})`);
			}
			requestViewJson = JSON.stringify(await response.json(), null, 2);
		} catch (error) {
			requestViewError = error instanceof Error ? error.message : String(error);
		} finally {
			isLoadingRequestView = false;
		}
	}

	$effect(() => {
		if (typeof EventSource === "undefined") {
			pollError = "Live updates are not supported in this browser";
			void fetchDbStateOnce();
			return;
		}
		const eventSource = new EventSource(`${apiBasePath}/state/stream`);
		const onState = (event: MessageEvent<string>) => {
			try {
				applyStatePayload(JSON.parse(event.data));
				if (activeView === "request-view") {
					void fetchRequestView();
				}
				pollError = null;
			} catch (error) {
				pollError = error instanceof Error ? error.message : String(error);
			}
		};
		eventSource.addEventListener("state", onState as EventListener);
		eventSource.onerror = () => {
			pollError = "Live updates disconnected; retrying...";
		};
		return () => {
			eventSource.removeEventListener("state", onState as EventListener);
			eventSource.close();
		};
	});

	$effect(() => {
		void activeView;
		void assessmentId;
		void sectionId;
		void attemptId;
		void mode;
		if (activeView !== "request-view") return;
		void fetchRequestView();
	});

	onMount(() => {
		void fetchDbStateOnce();
	});
</script>

<SharedFloatingPanel
	title="Session DB (Server)"
	ariaLabel="Drag session DB panel"
	minWidth={420}
	minHeight={320}
	initialSizing={{
		widthRatio: 0.38,
		heightRatio: 0.78,
		minWidth: 440,
		maxWidth: 900,
		minHeight: 380,
		maxHeight: 900,
		alignX: "right",
		alignY: "bottom",
		paddingX: 18,
		paddingY: 18,
	}}
	className="pie-demo-session-db-panel"
	bodyClass="pie-demo-session-db-panel__content-shell"
	onClose={onClose}
>
	<div class="pie-demo-session-db-panel__content">
		<div class="pie-demo-session-db-panel__meta">
			<div><strong>assessmentId:</strong> <code>{assessmentId}</code></div>
			{#if mode === "section"}
				<div><strong>sectionId:</strong> <code>{sectionId}</code></div>
			{/if}
			<div><strong>attemptId:</strong> <code>{attemptId}</code></div>
			<div><strong>mode:</strong> <code>{mode}</code></div>
		</div>

		<div class="pie-demo-session-db-panel__actions">
			<button
				type="button"
				class="pie-demo-session-db-panel__button"
				onclick={() => void handleResetDb()}
				disabled={isResettingDb}
				aria-busy={isResettingDb}
			>
				{isResettingDb ? "Resetting to baseline..." : "Reset DB to baseline"}
			</button>
			<button
				type="button"
				class="pie-demo-session-db-panel__button"
				onclick={() => (activeView = "raw-tables")}
				aria-pressed={activeView === "raw-tables"}
			>
				Show raw tables
			</button>
			<button
				type="button"
				class="pie-demo-session-db-panel__button"
				onclick={() => (activeView = "reconstructed")}
				aria-pressed={activeView === "reconstructed"}
			>
				Show reconstructed snapshots
			</button>
			<button
				type="button"
				class="pie-demo-session-db-panel__button"
				onclick={() => (activeView = "request-view")}
				aria-pressed={activeView === "request-view"}
			>
				{viewTitle}
			</button>
		</div>

		{#if pollError}
			<div class="pie-demo-session-db-panel__error">{pollError}</div>
		{/if}

		{#if activeView === "raw-tables"}
			<div class="pie-demo-session-db-panel__tables">
				{#each tableOrder as tableName}
					<h4 class="pie-demo-session-db-panel__table-title">{tableName}</h4>
					<div class="pie-demo-session-db-panel__table-wrap">
						<table class="pie-demo-session-db-panel__table">
							<thead>
								<tr>
									{#each scopedColumns[tableName] as column}
										<th title={column}>{abbreviateColumnName(column)}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#if scopedRows[tableName].length === 0}
									<tr>
										<td colspan={Math.max(scopedColumns[tableName].length, 1)}>No rows</td>
									</tr>
								{:else}
									{#each scopedRows[tableName] as row}
										<tr>
											{#each scopedColumns[tableName] as column}
												<td>{formatCellValue(row[column])}</td>
											{/each}
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		{:else if activeView === "reconstructed"}
			<textarea
				class="pie-demo-session-db-panel__json"
				readonly
				value={reconstructedSnapshotJson}
				spellcheck="false"
			></textarea>
		{:else}
			{#if requestViewError}
				<div class="pie-demo-session-db-panel__error">{requestViewError}</div>
			{/if}
			<textarea
				class="pie-demo-session-db-panel__json"
				readonly
				value={isLoadingRequestView ? "Loading request view..." : requestViewJson}
				spellcheck="false"
			></textarea>
		{/if}
	</div>
</SharedFloatingPanel>

<style>
	.pie-demo-session-db-panel__content {
		display: flex;
		flex-direction: column;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow-y: hidden;
		overflow-x: hidden;
		padding: 12px;
		font-size: 0.8rem;
	}

	.pie-demo-session-db-panel__meta {
		display: grid;
		gap: 0.2rem;
		margin-bottom: 0.55rem;
		font-size: 0.78rem;
	}

	.pie-demo-session-db-panel__actions {
		display: flex;
		gap: 0.45rem;
		margin-bottom: 0.5rem;
	}

	.pie-demo-session-db-panel__button {
		border: 1px solid var(--color-base-300, #d1d5db);
		background: var(--color-base-100, #fff);
		color: var(--color-base-content);
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.pie-demo-session-db-panel__button:hover {
		background: color-mix(in srgb, var(--color-base-200) 65%, white);
	}

	.pie-demo-session-db-panel__button[aria-pressed="true"] {
		background: color-mix(in srgb, var(--color-primary, #2563eb) 18%, transparent);
		font-weight: 600;
	}

	.pie-demo-session-db-panel__button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.pie-demo-session-db-panel__error {
		margin-bottom: 0.5rem;
		padding: 0.4rem 0.45rem;
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--color-error) 12%, var(--color-base-100));
		border: 1px solid color-mix(in srgb, var(--color-error) 35%, var(--color-base-300));
	}

	.pie-demo-session-db-panel__tables {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
		min-height: 0;
		overflow: auto;
	}

	.pie-demo-session-db-panel__table-title {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: lowercase;
	}

	.pie-demo-session-db-panel__table-wrap {
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--color-base-200) 65%, white);
		overflow: auto;
		max-height: 9.5rem;
	}

	.pie-demo-session-db-panel__table {
		width: 100%;
		border-collapse: collapse;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.72rem;
	}

	.pie-demo-session-db-panel__table th,
	.pie-demo-session-db-panel__table td {
		padding: 0.25rem 0.35rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-base-content) 14%, transparent);
		vertical-align: top;
		text-align: left;
	}

	.pie-demo-session-db-panel__table th {
		position: sticky;
		top: 0;
		background: color-mix(in srgb, var(--color-base-200) 85%, white);
		font-weight: 700;
		font-size: 0.66rem;
		line-height: 1.15;
		padding: 0.18rem 0.3rem;
		white-space: nowrap;
	}

	.pie-demo-session-db-panel__table td {
		white-space: nowrap;
	}

	.pie-demo-session-db-panel__meta code,
	.pie-demo-session-db-panel__json {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}

	.pie-demo-session-db-panel__json {
		width: 100%;
		flex: 1;
		min-height: 14rem;
		resize: none;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		border: 1px solid color-mix(in srgb, var(--color-base-content) 25%, transparent);
		border-radius: 0.3rem;
		padding: 0.45rem;
		background: color-mix(in srgb, var(--color-base-200) 65%, white);
		color: var(--color-base-content);
		box-sizing: border-box;
	}
</style>
