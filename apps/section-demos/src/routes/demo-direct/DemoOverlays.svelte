<script lang="ts">
	import SourcePanel from './SourcePanel.svelte';

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
		toolkitCoordinator,
		showSessionPanel,
		showSourcePanel,
		showPnpPanel,
		sourcePanelJson,
		onCloseSourcePanel,
		sessionDebuggerElement = $bindable(null),
		pnpDebuggerElement = $bindable(null)
	}: Props = $props();
</script>

<!-- Annotation Toolbar (floating, appears on text selection) -->
<!-- Outside main container to avoid overflow: hidden affecting fixed positioning -->
{#if toolkitCoordinator}
	<pie-tool-annotation-toolbar
		enabled={true}
		ttsService={toolkitCoordinator.ttsService}
		highlightCoordinator={toolkitCoordinator.highlightCoordinator}
	></pie-tool-annotation-toolbar>
{/if}

<!-- Floating Session Window -->
{#if showSessionPanel}
	<pie-section-player-tools-session-debugger bind:this={sessionDebuggerElement}>
	</pie-section-player-tools-session-debugger>
{/if}

<!-- Floating Source Window -->
{#if showSourcePanel}
	<SourcePanel editedSourceJson={sourcePanelJson} onClose={onCloseSourcePanel} />
{/if}

<!-- Floating PNP Profile Window -->
{#if showPnpPanel}
	<pie-section-player-tools-pnp-debugger bind:this={pnpDebuggerElement}>
	</pie-section-player-tools-pnp-debugger>
{/if}
