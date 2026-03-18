<script lang="ts">
	import type { PieItemSessionDebuggerElement } from '@pie-players/pie-item-player/components/item-session-debugger-element';
	import '@pie-players/pie-item-player/components/item-session-debugger-element';
import '@pie-players/pie-section-player-tools-instrumentation-debugger';

	interface Props {
		demoName: string;
		demoId: string;
		config: unknown;
		showSessionPanel: boolean;
		showInstrumentationPanel: boolean;
		session: unknown;
		env: unknown;
		score: unknown;
		sessionDebuggerElement?: PieItemSessionDebuggerElement | null;
		instrumentationDebuggerElement?: HTMLElement | null;
	}

	let {
		demoName,
		demoId,
		config,
		showSessionPanel,
		showInstrumentationPanel,
		session,
		env,
		score,
		sessionDebuggerElement = $bindable(null),
		instrumentationDebuggerElement = $bindable(null),
	}: Props = $props();
</script>

{#if showSessionPanel}
	<pie-item-player-session-debugger
		bind:this={sessionDebuggerElement}
		itemName={demoName}
		itemId={demoId}
		{config}
		{session}
		{env}
		{score}
	></pie-item-player-session-debugger>
{/if}

{#if showInstrumentationPanel}
	<pie-section-player-tools-instrumentation-debugger
		bind:this={instrumentationDebuggerElement}
	></pie-section-player-tools-instrumentation-debugger>
{/if}
