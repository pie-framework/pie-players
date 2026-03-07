<svelte:options
	customElement={{
		tag: "pie-section-player-shell",
		shadow: "open",
		props: {
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-toolbars/components/section-toolbar-element";
	import { coerceBooleanLike } from "./shared/section-player-props.js";

	let {
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
	} = $props<{
		showToolbar?: boolean | string | null | undefined;
		toolbarPosition?: string;
		enabledTools?: string;
	}>();

	const shouldRenderToolbar = $derived(
		coerceBooleanLike(showToolbar, false) && toolbarPosition !== "none",
	);
	const toolbarBeforeContent = $derived(toolbarPosition === "top");
	const toolbarAfterContent = $derived(toolbarPosition === "bottom");
	const toolbarInline = $derived(toolbarPosition === "left" || toolbarPosition === "right");
</script>

<div class={`pie-section-player-shell pie-section-player-shell--${toolbarPosition}`}>
	{#if shouldRenderToolbar && toolbarBeforeContent}
		<pie-section-toolbar
			class={`pie-section-player-toolbar pie-section-player-toolbar--${toolbarPosition}`}
			position={toolbarPosition}
			enabled-tools={enabledTools}
		></pie-section-toolbar>
	{/if}

	<div
		class={`pie-section-player-layout-body ${
			shouldRenderToolbar && toolbarInline
				? `pie-section-player-layout-body--inline pie-section-player-layout-body--inline-${toolbarPosition}`
				: ""
		}`}
	>
		{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "left"}
			<aside
				class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--left"
				aria-label="Section tools"
			>
				<pie-section-toolbar
					position="left"
					enabled-tools={enabledTools}
				></pie-section-toolbar>
			</aside>
		{/if}

		<slot></slot>

		{#if shouldRenderToolbar && toolbarInline && toolbarPosition === "right"}
			<aside
				class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--right"
				aria-label="Section tools"
			>
				<pie-section-toolbar
					position="right"
					enabled-tools={enabledTools}
				></pie-section-toolbar>
			</aside>
		{/if}
	</div>

	{#if shouldRenderToolbar && toolbarAfterContent}
		<pie-section-toolbar
			class={`pie-section-player-toolbar pie-section-player-toolbar--${toolbarPosition}`}
			position={toolbarPosition}
			enabled-tools={enabledTools}
		></pie-section-toolbar>
	{/if}
</div>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	.pie-section-player-shell {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}

	.pie-section-player-layout-body {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}

	.pie-section-player-layout-body--inline {
		gap: 0;
	}

	.pie-section-player-layout-body--inline-left {
		grid-template-columns: auto minmax(0, 1fr);
	}

	.pie-section-player-layout-body--inline-right {
		grid-template-columns: minmax(0, 1fr) auto;
	}

	.pie-section-player-toolbar-pane {
		min-height: 0;
		overflow: auto;
		padding: 0.25rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
	}

	.pie-section-player-toolbar-pane--right {
		border-left: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-toolbar-pane--left {
		border-right: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-toolbar {
		margin: 0.25rem;
	}

	.pie-section-player-toolbar-pane pie-section-toolbar {
		margin: 0.25rem;
	}

	@media (max-width: 1100px) {
		.pie-section-player-layout-body--inline {
			grid-template-columns: 1fr;
		}

		.pie-section-player-toolbar-pane--left,
		.pie-section-player-toolbar-pane--right {
			border: none;
			padding: 0;
		}
	}
</style>
