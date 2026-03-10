<script lang="ts">
	import type { PieItemSessionDebuggerElement } from '@pie-players/pie-item-player/components/item-session-debugger-element';
	import '@pie-players/pie-item-player/components/item-session-debugger-element';

	interface Props {
		demoName: string;
		demoId: string;
		config: unknown;
		showSessionPanel: boolean;
		session: unknown;
		env: unknown;
		score: unknown;
		sessionDebuggerElement?: PieItemSessionDebuggerElement | null;
	}

	let {
		demoName,
		demoId,
		config,
		showSessionPanel,
		session,
		env,
		score,
		sessionDebuggerElement = $bindable(null),
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
