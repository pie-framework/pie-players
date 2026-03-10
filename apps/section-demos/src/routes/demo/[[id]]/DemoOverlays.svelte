<script lang="ts">
	import SourcePanel from './SourcePanel.svelte';
	import SessionControlsPanel from './SessionControlsPanel.svelte';
	import TTSSettingsDialog from './TTSSettingsDialog.svelte';

	interface Props {
		toolkitCoordinator: any;
		sectionId: string;
		attemptId: string;
		showSessionPanel: boolean;
		showSessionControlsPanel: boolean;
		showEventPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		showTtsPanel: boolean;
		sourcePanelJson: string;
		hostSessionSnapshot: {
			currentItemIndex?: number;
			visitedItemIdentifiers?: string[];
			itemSessions?: Record<string, unknown>;
		} | null;
		sessionControlItemIds: string[];
		persistenceStorageKey: string | null;
		persistenceStoragePresent: boolean;
		lastSessionSavedAt: number | null;
		lastSessionRestoredAt: number | null;
		lastHostSessionUpdateAt: number | null;
		lastSessionRefreshAt: number | null;
		onRefreshHostSession: () => void | Promise<void>;
		onPersistHostSession: () => void | Promise<void>;
		onHydrateHostSession: () => void | Promise<void>;
		onApplyHostSessionSnapshot: (
			snapshot: Record<string, unknown>,
			mode: "replace" | "merge",
		) => void | Promise<void>;
		onUpdateHostItemSession: (
			itemId: string,
			detail: Record<string, unknown>,
		) => void | Promise<void>;
		onCloseSessionControlsPanel: () => void;
		onCloseSourcePanel: () => void;
		onCloseTtsPanel: () => void;
		sessionDebuggerElement?: any;
		eventDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		toolkitCoordinator,
		sectionId,
		attemptId,
		showSessionPanel,
		showSessionControlsPanel,
		showEventPanel,
		showSourcePanel,
		showPnpPanel,
		showTtsPanel,
		sourcePanelJson,
		hostSessionSnapshot,
		sessionControlItemIds,
		persistenceStorageKey,
		persistenceStoragePresent,
		lastSessionSavedAt,
		lastSessionRestoredAt,
		lastHostSessionUpdateAt,
		lastSessionRefreshAt,
		onRefreshHostSession,
		onPersistHostSession,
		onHydrateHostSession,
		onApplyHostSessionSnapshot,
		onUpdateHostItemSession,
		onCloseSessionControlsPanel,
		onCloseSourcePanel,
		onCloseTtsPanel,
		sessionDebuggerElement = $bindable(null),
		eventDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null)
	}: Props = $props();
</script>

{#if showSessionControlsPanel}
	<SessionControlsPanel
		sectionId={sectionId}
		{attemptId}
		itemIds={sessionControlItemIds}
		sessionSnapshot={hostSessionSnapshot}
		{persistenceStorageKey}
		{persistenceStoragePresent}
		lastSavedAt={lastSessionSavedAt}
		lastRestoredAt={lastSessionRestoredAt}
		lastHostUpdateAt={lastHostSessionUpdateAt}
		lastRefreshAt={lastSessionRefreshAt}
		onRefresh={onRefreshHostSession}
		onPersistNow={onPersistHostSession}
		onHydrateNow={onHydrateHostSession}
		onApplySessionSnapshot={onApplyHostSessionSnapshot}
		onUpdateItemSession={onUpdateHostItemSession}
		onClose={onCloseSessionControlsPanel}
	/>
{/if}

{#if showSessionPanel}
	<pie-section-player-tools-session-debugger
		bind:this={sessionDebuggerElement}
		toolkitCoordinator={toolkitCoordinator}
		sectionId={sectionId}
		attemptId={attemptId}
	>
	</pie-section-player-tools-session-debugger>
{/if}

{#if showEventPanel}
	<pie-section-player-tools-event-debugger
		bind:this={eventDebuggerElement}
		toolkitCoordinator={toolkitCoordinator}
		sectionId={sectionId}
		attemptId={attemptId}
	>
	</pie-section-player-tools-event-debugger>
{/if}

{#if showSourcePanel}
	<SourcePanel editedSourceJson={sourcePanelJson} onClose={onCloseSourcePanel} />
{/if}

{#if showPnpPanel}
	<pie-section-player-tools-pnp-debugger bind:this={pnpDebuggerElement}>
	</pie-section-player-tools-pnp-debugger>
{/if}

{#if showTtsPanel}
	<TTSSettingsDialog {toolkitCoordinator} onClose={onCloseTtsPanel} />
{/if}
