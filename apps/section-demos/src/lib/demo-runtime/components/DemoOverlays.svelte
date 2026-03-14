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
		sessionDebuggerElement?: any;
		eventDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		toolkitCoordinator,
		sectionId,
		attemptId,
		showSessionPanel,
		showEventPanel,
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
		sessionDebuggerElement = $bindable(null),
		eventDebuggerElement = $bindable(null),
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

{#if isSessionHydrateDbDemo && showSessionDbPanel}
	<SessionDbPanel
		assessmentId="section-demos-assessment"
		{sectionId}
		{attemptId}
		{onResetDb}
		onClose={onCloseSessionDbPanel}
	/>
{/if}
