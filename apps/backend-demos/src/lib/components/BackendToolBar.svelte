<script lang="ts">
	import ToolToggleButton from "./ToolToggleButton.svelte";

	interface Props {
		showModelPanel: boolean;
		showSessionPanel: boolean;
		showEventsPanel: boolean;
		onToggleModelPanel: () => void;
		onToggleSessionPanel: () => void;
		onToggleEventsPanel: () => void;
	}

	let {
		showModelPanel,
		showSessionPanel,
		showEventsPanel,
		onToggleModelPanel,
		onToggleSessionPanel,
		onToggleEventsPanel,
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Backend demo tools">
	<span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">Tools</span>

	<ToolToggleButton
		active={showModelPanel}
		label="backend model flow"
		title="Backend model flow"
		onToggle={onToggleModelPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6h6m-6 4h6m-7 4h8m-9 6h10a2 2 0 002-2V6.5L14.5 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
		</svg>
	</ToolToggleButton>

	<ToolToggleButton
		active={showSessionPanel}
		label="backend state"
		title="Backend state"
		onToggle={onToggleSessionPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
		</svg>
	</ToolToggleButton>

	<ToolToggleButton
		active={showEventsPanel}
		label="traffic"
		title="Backend traffic"
		onToggle={onToggleEventsPanel}
	>
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0l-3-3m3 3l-3 3M3 17h8m0 0l-3-3m3 3l-3 3M3 7h5m8 10h5" />
		</svg>
	</ToolToggleButton>
</div>
