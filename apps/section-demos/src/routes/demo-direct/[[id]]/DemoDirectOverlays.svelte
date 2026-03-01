<script lang="ts">
	import SourcePanel from '../../demo/[[id]]/SourcePanel.svelte';

	interface Props {
		toolkitCoordinator: any;
		showSessionPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		sourcePanelJson: string;
		onCloseSourcePanel: () => void;
		sessionDebuggerElement?: any;
		pnpDebuggerElement?: any;
	}

	let {
		showSessionPanel,
		showSourcePanel,
		showPnpPanel,
		sourcePanelJson,
		onCloseSourcePanel,
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
