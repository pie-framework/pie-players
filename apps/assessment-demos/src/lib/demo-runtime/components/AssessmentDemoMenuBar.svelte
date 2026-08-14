<script lang="ts">
	import { ResponsiveDemoMenuBar } from "@pie-players/demo-ui";
	import { DebugPanelToggles } from "@pie-players/pie-section-player-tools-shared";

	interface Props {
		sectionLayout: "splitpane" | "vertical";
		showSessionPanel: boolean;
		showEventPanel: boolean;
		showInstrumentationPanel?: boolean;
		showDbPanel?: boolean;
		onSetSplitpaneLayout: () => void;
		onSetVerticalLayout: () => void;
		onResetAttempt?: () => void;
		onToggleSessionPanel: () => void;
		onToggleEventPanel: () => void;
		onToggleInstrumentationPanel?: () => void;
		onToggleDbPanel?: () => void;
	}

	let {
		sectionLayout,
		showSessionPanel,
		showEventPanel,
		showInstrumentationPanel = false,
		showDbPanel = false,
		onSetSplitpaneLayout,
		onSetVerticalLayout,
		onResetAttempt,
		onToggleSessionPanel,
		onToggleEventPanel,
		onToggleInstrumentationPanel,
		onToggleDbPanel,
	}: Props = $props();
</script>

<ResponsiveDemoMenuBar class="bg-base-200 mb-0 sticky top-0 z-50 shadow-lg">
	{#snippet start()}
		<a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
	{/snippet}

	{#snippet primary()}
		<div class="join">
			<button
				type="button"
				class="btn btn-sm join-item"
				class:btn-active={sectionLayout === "splitpane"}
				onclick={onSetSplitpaneLayout}
				title="Splitpane layout"
				aria-label="Use splitpane section player layout"
				aria-pressed={sectionLayout === "splitpane"}
			>
				Splitpane
			</button>
			<button
				type="button"
				class="btn btn-sm join-item"
				class:btn-active={sectionLayout === "vertical"}
				onclick={onSetVerticalLayout}
				title="Vertical layout"
				aria-label="Use vertical section player layout"
				aria-pressed={sectionLayout === "vertical"}
			>
				Vertical
			</button>
		</div>
	{/snippet}

	{#snippet secondary()}
		{#if onResetAttempt}
			<button
				type="button"
				class="btn btn-sm btn-outline"
				onclick={onResetAttempt}
				title="Reset attempt"
				aria-label="Reset attempt"
			>
				Reset Attempt
			</button>
		{/if}
		<DebugPanelToggles
			{showSessionPanel}
			{showEventPanel}
			{showInstrumentationPanel}
			{showDbPanel}
			{onToggleSessionPanel}
			{onToggleEventPanel}
			{onToggleInstrumentationPanel}
			{onToggleDbPanel}
		/>
	{/snippet}
</ResponsiveDemoMenuBar>
