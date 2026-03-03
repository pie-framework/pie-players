<script lang="ts">
	import SourcePanel from './SourcePanel.svelte';
	import TTSSettingsDialog from './TTSSettingsDialog.svelte';

	interface Props {
		toolkitCoordinator: any;
		showSessionPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		showTtsPanel: boolean;
		sourcePanelJson: string;
		onCloseSourcePanel: () => void;
		onCloseTtsPanel: () => void;
		sessionDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		toolkitCoordinator,
		showSessionPanel,
		showSourcePanel,
		showPnpPanel,
		showTtsPanel,
		sourcePanelJson,
		onCloseSourcePanel,
		onCloseTtsPanel,
		sessionDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null)
	}: Props = $props();
</script>

{#if showSessionPanel}
	<pie-section-player-tools-session-debugger bind:this={sessionDebuggerElement}>
	</pie-section-player-tools-session-debugger>
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
