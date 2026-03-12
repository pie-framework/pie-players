<script lang="ts">
	import PanelResizeHandle from '@pie-players/pie-section-player-tools-shared/PanelResizeHandle.svelte';
	import PanelWindowControls from '@pie-players/pie-section-player-tools-shared/PanelWindowControls.svelte';
	import {
		claimNextFloatingPanelZIndex,
		computePanelSizeFromViewport,
		createFloatingPanelPointerController
	} from '@pie-players/pie-section-player-tools-shared';
	import { onMount } from 'svelte';

	interface Props {
		assessmentId: string;
		sectionId: string;
		attemptId: string;
		onResetDb: () => void | Promise<void>;
		onClose: () => void;
	}

	let {
		assessmentId,
		sectionId,
		attemptId,
		onResetDb,
		onClose
	}: Props = $props();

	let isPanelMinimized = $state(false);
	let panelX = $state(0);
	let panelY = $state(0);
	let panelWidth = $state(640);
	let panelHeight = $state(640);
	let dbPanelZIndex = $state(claimNextFloatingPanelZIndex());
	let pollError = $state<string | null>(null);
	let activeView = $state<'raw-tables' | 'reconstructed' | 'section-request'>('raw-tables');
	let latestState = $state<Record<string, unknown> | null>(null);
	let isResettingDb = $state(false);
	let scopedAttemptRows = $state<Array<Record<string, unknown>>>([]);
	let scopedSectionRows = $state<Array<Record<string, unknown>>>([]);
	let scopedItemRows = $state<Array<Record<string, unknown>>>([]);
	let scopedSnapshot = $state<Record<string, unknown> | null>(null);
	let attemptColumns = $state<string[]>([]);
	let sectionColumns = $state<string[]>([]);
	let itemColumns = $state<string[]>([]);
	let reconstructedSnapshotJson = $state<string>('{}');
	let sectionRequestJson = $state<string>('{}');
	let sectionRequestError = $state<string | null>(null);
	let isLoadingSectionRequest = $state(false);
	const POLL_TIMEOUT_MS = 4500;

	function bringToFront(): void {
		dbPanelZIndex = claimNextFloatingPanelZIndex();
	}

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: panelX,
			y: panelY,
			width: panelWidth,
			height: panelHeight
		}),
		setState: (next) => {
			panelX = next.x;
			panelY = next.y;
			panelWidth = next.width;
			panelHeight = next.height;
		},
		minWidth: 420,
		minHeight: 320,
		onFocus: bringToFront
	});

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
		if (value === null || value === undefined) return '';
		if (typeof value === 'object') {
			try {
				return JSON.stringify(value);
			} catch {
				return '[unserializable]';
			}
		}
		return String(value);
	}

	function applyStatePayload(payload: unknown): void {
		const state = (payload as { state?: Record<string, unknown> } | null)?.state || {};
		latestState = state;
		const stateTables = (state?.tables as Record<string, unknown> | undefined) || {};
		const attemptRows = Array.isArray(stateTables?.attempt_sessions)
			? stateTables.attempt_sessions
			: [];
		const targetAttemptRows = attemptRows.filter((row) => {
			const candidate = row as Record<string, unknown>;
			return (
				candidate.assessment_id === assessmentId &&
				candidate.attempt_id === attemptId
			);
		});
		const targetAttemptIds = new Set(
			targetAttemptRows
				.map((row) => (row as Record<string, unknown>).id)
				.filter((id): id is number => typeof id === 'number')
		);
		const sectionRows = Array.isArray(stateTables?.section_sessions)
			? stateTables.section_sessions
			: [];
		const targetSectionRows = sectionRows.filter((row) => {
			const candidate = row as Record<string, unknown>;
			return (
				targetAttemptIds.has(candidate.attempt_session_id as number) &&
				candidate.section_id === sectionId
			);
		});
		const targetSectionIds = new Set(
			targetSectionRows
				.map((row) => (row as Record<string, unknown>).id)
				.filter((id): id is number => typeof id === 'number')
		);
		const itemRows = Array.isArray(stateTables?.item_sessions)
			? stateTables.item_sessions
			: [];
		const targetItemRows = itemRows.filter((row) =>
			targetSectionIds.has((row as Record<string, unknown>).section_session_id as number)
		);
		const scopedTables = {
			attempt_sessions: targetAttemptRows,
			section_sessions: targetSectionRows,
			item_sessions: targetItemRows
		};
		const snapshotKey = `${assessmentId}:${sectionId}:${attemptId}`;
		const reconstructedSnapshots =
			(state?.reconstructedSnapshots as Record<string, unknown> | undefined) || {};
		const scopedReconstructedSnapshots = reconstructedSnapshots[snapshotKey]
			? { [snapshotKey]: reconstructedSnapshots[snapshotKey] }
			: {};

		scopedAttemptRows = scopedTables.attempt_sessions as Array<Record<string, unknown>>;
		scopedSectionRows = scopedTables.section_sessions as Array<Record<string, unknown>>;
		scopedItemRows = scopedTables.item_sessions as Array<Record<string, unknown>>;
		attemptColumns = collectColumns(scopedAttemptRows);
		sectionColumns = collectColumns(scopedSectionRows);
		itemColumns = collectColumns(scopedItemRows);

		scopedSnapshot = (scopedReconstructedSnapshots[snapshotKey] as Record<string, unknown>) || null;
		reconstructedSnapshotJson = JSON.stringify(scopedSnapshot || {}, null, 2);
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
			const response = await fetch('/api/session-demo/state', {
				signal: controller.signal,
				cache: 'no-store'
			});
			if (!response.ok) {
				throw new Error(`DB state request failed (${response.status})`);
			}
			applyStatePayload(await response.json());
			pollError = null;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				pollError = `DB state request timed out after ${POLL_TIMEOUT_MS}ms`;
			} else {
				pollError = error instanceof Error ? error.message : String(error);
			}
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async function fetchSectionRequestView(): Promise<void> {
		if (activeView !== 'section-request') return;
		isLoadingSectionRequest = true;
		sectionRequestError = null;
		const query = new URLSearchParams({
			assessmentId,
			sectionId,
			attemptId,
		});
		try {
			const response = await fetch(`/api/session-demo/activity/load?${query.toString()}`, {
				cache: 'no-store'
			});
			if (!response.ok) {
				throw new Error(`Section request failed (${response.status})`);
			}
			const payload = await response.json();
			sectionRequestJson = JSON.stringify(payload, null, 2);
		} catch (error) {
			sectionRequestError = error instanceof Error ? error.message : String(error);
		} finally {
			isLoadingSectionRequest = false;
		}
	}

	$effect(() => {
		return () => {
			pointerController.stop();
		};
	});

	$effect(() => {
		if (typeof EventSource === 'undefined') {
			pollError = 'Live updates are not supported in this browser';
			void fetchDbStateOnce();
			return;
		}
		const eventSource = new EventSource('/api/session-demo/state/stream');
		const onState = (event: MessageEvent<string>) => {
			try {
				applyStatePayload(JSON.parse(event.data));
				if (activeView === 'section-request') {
					void fetchSectionRequestView();
				}
				pollError = null;
			} catch (error) {
				pollError = error instanceof Error ? error.message : String(error);
			}
		};
		eventSource.addEventListener('state', onState as EventListener);
		eventSource.onerror = () => {
			pollError = 'Live updates disconnected; retrying...';
		};
		return () => {
			eventSource.removeEventListener('state', onState as EventListener);
			eventSource.close();
		};
	});

	$effect(() => {
		void activeView;
		void assessmentId;
		void sectionId;
		void attemptId;
		if (activeView !== 'section-request') return;
		void fetchSectionRequestView();
	});

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			{
				widthRatio: 0.38,
				heightRatio: 0.78,
				minWidth: 440,
				maxWidth: 900,
				minHeight: 380,
				maxHeight: 900,
				alignX: 'right',
				alignY: 'bottom',
				paddingX: 18,
				paddingY: 18
			}
		);
		panelX = initial.x;
		panelY = initial.y;
		panelWidth = initial.width;
		panelHeight = initial.height;
	});
</script>

<aside
	class="pie-demo-session-db-panel"
	aria-label="Session database state panel"
	style="left: {panelX}px; top: {panelY}px; width: {panelWidth}px; z-index: {dbPanelZIndex}; {isPanelMinimized ? 'height: auto;' : `height: ${panelHeight}px;`}"
>
	<div class="pie-demo-session-db-panel__header">
		<div
			class="pie-demo-session-db-panel__title-wrap"
			onmousedown={(event: MouseEvent) => pointerController.startDrag(event)}
			role="button"
			tabindex="0"
			aria-label="Drag session DB panel"
		>
			<h3 class="pie-demo-session-db-panel__title">Session DB (Server)</h3>
		</div>
		<PanelWindowControls
			minimized={isPanelMinimized}
			onToggle={() => (isPanelMinimized = !isPanelMinimized)}
			onClose={onClose}
		/>
	</div>

	{#if !isPanelMinimized}
		<div class="pie-demo-session-db-panel__content-shell" style="height: {panelHeight - 50}px;">
			<div class="pie-demo-session-db-panel__content">
				<div class="pie-demo-session-db-panel__meta">
					<div><strong>assessmentId:</strong> <code>{assessmentId}</code></div>
					<div><strong>sectionId:</strong> <code>{sectionId}</code></div>
					<div><strong>attemptId:</strong> <code>{attemptId}</code></div>
				</div>

				<div class="pie-demo-session-db-panel__actions">
					<button
						type="button"
						class="pie-demo-session-db-panel__button"
						onclick={() => void handleResetDb()}
						disabled={isResettingDb}
						aria-busy={isResettingDb}
					>
						{isResettingDb ? 'Resetting to baseline...' : 'Reset DB to baseline'}
					</button>
					<button
						type="button"
						class="pie-demo-session-db-panel__button"
						onclick={() => (activeView = 'raw-tables')}
						aria-pressed={activeView === 'raw-tables'}
					>
						Show raw tables
					</button>
					<button
						type="button"
						class="pie-demo-session-db-panel__button"
						onclick={() => (activeView = 'reconstructed')}
						aria-pressed={activeView === 'reconstructed'}
					>
						Show reconstructed snapshots
					</button>
					<button
						type="button"
						class="pie-demo-session-db-panel__button"
						onclick={() => (activeView = 'section-request')}
						aria-pressed={activeView === 'section-request'}
					>
						Show section request
					</button>
				</div>

				{#if pollError}
					<div class="pie-demo-session-db-panel__error">{pollError}</div>
				{/if}

				{#if activeView === 'raw-tables'}
					<div class="pie-demo-session-db-panel__tables">
						<h4 class="pie-demo-session-db-panel__table-title">attempt_sessions</h4>
						<div class="pie-demo-session-db-panel__table-wrap">
							<table class="pie-demo-session-db-panel__table">
								<thead>
									<tr>
										{#each attemptColumns as column}
											<th>{column}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#if scopedAttemptRows.length === 0}
										<tr><td colspan={Math.max(attemptColumns.length, 1)}>No rows</td></tr>
									{:else}
										{#each scopedAttemptRows as row}
											<tr>
												{#each attemptColumns as column}
													<td>{formatCellValue(row[column])}</td>
												{/each}
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>

						<h4 class="pie-demo-session-db-panel__table-title">section_sessions</h4>
						<div class="pie-demo-session-db-panel__table-wrap">
							<table class="pie-demo-session-db-panel__table">
								<thead>
									<tr>
										{#each sectionColumns as column}
											<th>{column}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#if scopedSectionRows.length === 0}
										<tr><td colspan={Math.max(sectionColumns.length, 1)}>No rows</td></tr>
									{:else}
										{#each scopedSectionRows as row}
											<tr>
												{#each sectionColumns as column}
													<td>{formatCellValue(row[column])}</td>
												{/each}
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>

						<h4 class="pie-demo-session-db-panel__table-title">item_sessions</h4>
						<div class="pie-demo-session-db-panel__table-wrap">
							<table class="pie-demo-session-db-panel__table">
								<thead>
									<tr>
										{#each itemColumns as column}
											<th>{column}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#if scopedItemRows.length === 0}
										<tr><td colspan={Math.max(itemColumns.length, 1)}>No rows</td></tr>
									{:else}
										{#each scopedItemRows as row}
											<tr>
												{#each itemColumns as column}
													<td>{formatCellValue(row[column])}</td>
												{/each}
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				{:else if activeView === 'reconstructed'}
					<textarea
						class="pie-demo-session-db-panel__json"
						readonly
						value={reconstructedSnapshotJson}
						spellcheck="false"
					></textarea>
				{:else}
					{#if sectionRequestError}
						<div class="pie-demo-session-db-panel__error">{sectionRequestError}</div>
					{/if}
					<textarea
						class="pie-demo-session-db-panel__json"
						readonly
						value={isLoadingSectionRequest ? 'Loading section request...' : sectionRequestJson}
						spellcheck="false"
					></textarea>
				{/if}
			</div>
		</div>
		<PanelResizeHandle onPointerDown={(event: MouseEvent) => pointerController.startResize(event)} />
	{/if}
</aside>

<style>
	.pie-demo-session-db-panel {
		position: fixed;
		background: var(--color-base-100);
		color: var(--color-base-content);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
		font-size: 0.82rem;
	}

	.pie-demo-session-db-panel__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-demo-session-db-panel__title-wrap {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
		cursor: move;
		user-select: none;
	}

	.pie-demo-session-db-panel__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-demo-session-db-panel__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pie-demo-session-db-panel__content {
		display: flex;
		flex-direction: column;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow-y: hidden;
		overflow-x: hidden;
		padding: 12px;
	}

	.pie-demo-session-db-panel__meta {
		display: grid;
		gap: 0.2rem;
		margin-bottom: 0.55rem;
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
		transition: background-color 120ms ease, border-color 120ms ease,
			transform 80ms ease;
	}

	.pie-demo-session-db-panel__button:hover {
		background: color-mix(in srgb, var(--color-primary) 12%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-base-300));
	}

	.pie-demo-session-db-panel__button[aria-pressed='true'] {
		background: color-mix(in srgb, var(--color-primary) 15%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-base-300));
	}

	.pie-demo-session-db-panel__button:active {
		transform: translateY(1px);
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
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
	}

	.pie-demo-session-db-panel__table th,
	.pie-demo-session-db-panel__table td {
		padding: 0.25rem 0.35rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-base-content) 14%, transparent);
		vertical-align: top;
		text-align: left;
		white-space: nowrap;
	}

	.pie-demo-session-db-panel__table th {
		position: sticky;
		top: 0;
		background: color-mix(in srgb, var(--color-base-200) 85%, white);
		font-weight: 700;
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
