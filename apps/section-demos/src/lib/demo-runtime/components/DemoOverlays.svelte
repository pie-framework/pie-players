<script lang="ts">
	import SourcePanel from './SourcePanel.svelte';
	import SessionDbPanel from './SessionDbPanel.svelte';
	import TTSSettingsDialog from './TTSSettingsDialog.svelte';

	interface Props {
		toolkitCoordinator: any;
		sectionId: string;
		attemptId: string;
		showSessionPanel: boolean;
		showEventPanel: boolean;
		showInstrumentationPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		showTtsPanel: boolean;
		showSessionDbPanel: boolean;
		sourcePanelJson: string;
		isSessionHydrateDbDemo: boolean;
		onCloseSourcePanel: () => void;
		onCloseTtsPanel: () => void;
		onCloseSessionDbPanel: () => void;
		onResetDb: () => void | Promise<void>;
		panelPersistenceScope?: string;
		eventPanelPersistenceId?: string;
		instrumentationPanelPersistenceId?: string;
		eventPanelMaxEvents?: number;
		eventPanelMaxEventsByLevel?: Partial<Record<"item" | "section", number>>;
		instrumentationPanelMaxRecords?: number;
		instrumentationPanelMaxRecordsByKind?: Partial<
			Record<"event" | "error" | "metric" | "user-context" | "global-attributes", number>
		>;
		sessionDebuggerElement?: any;
		eventDebuggerElement?: any;
		instrumentationDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		toolkitCoordinator,
		sectionId,
		attemptId,
		showSessionPanel,
		showEventPanel,
		showInstrumentationPanel,
		showSourcePanel,
		showPnpPanel,
		showTtsPanel,
		showSessionDbPanel,
		sourcePanelJson,
		isSessionHydrateDbDemo,
		onCloseSourcePanel,
		onCloseTtsPanel,
		onCloseSessionDbPanel,
		onResetDb,
		panelPersistenceScope = "",
		eventPanelPersistenceId = "controller-events",
		instrumentationPanelPersistenceId = "instrumentation-events",
		eventPanelMaxEvents = 200,
		eventPanelMaxEventsByLevel = {},
		instrumentationPanelMaxRecords = 250,
		instrumentationPanelMaxRecordsByKind = {},
		sessionDebuggerElement = $bindable(null),
		eventDebuggerElement = $bindable(null),
		instrumentationDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null)
	}: Props = $props();
</script>

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
		maxEvents={eventPanelMaxEvents}
		maxEventsByLevel={eventPanelMaxEventsByLevel}
		persistenceScope={panelPersistenceScope}
		persistencePanelId={eventPanelPersistenceId}
	>
	</pie-section-player-tools-event-debugger>
{/if}

{#if showInstrumentationPanel}
	<pie-section-player-tools-instrumentation-debugger
		bind:this={instrumentationDebuggerElement}
		maxRecords={instrumentationPanelMaxRecords}
		maxRecordsByKind={instrumentationPanelMaxRecordsByKind}
		persistenceScope={panelPersistenceScope}
		persistencePanelId={instrumentationPanelPersistenceId}
	>
	</pie-section-player-tools-instrumentation-debugger>
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

{#if isSessionHydrateDbDemo && showSessionDbPanel}
	<SessionDbPanel
		assessmentId="section-demos-assessment"
		{sectionId}
		{attemptId}
		{onResetDb}
		onClose={onCloseSessionDbPanel}
	/>
{/if}
