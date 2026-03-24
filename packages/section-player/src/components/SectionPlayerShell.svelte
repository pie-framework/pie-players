<svelte:options
	customElement={{
		tag: "pie-section-player-shell",
		shadow: "open",
		props: {
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			sectionHostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-toolbars/components/section-toolbar-element";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import { coerceBooleanLike } from "./shared/section-player-props.js";

	const DEFAULT_COLLAPSED_BREAKPOINT_PX = 1100;

	let {
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
	} = $props<{
		showToolbar?: boolean | string | null | undefined;
		toolbarPosition?: string;
		enabledTools?: string;
		toolRegistry?: ToolRegistry | null;
		sectionHostButtons?: ToolbarItem[];
	}>();

	let isNarrow = $state(false);

	$effect(() => {
		if (typeof window === "undefined") return;
		const query = window.matchMedia(
			`(max-width: ${DEFAULT_COLLAPSED_BREAKPOINT_PX}px)`,
		);
		const update = () => {
			isNarrow = query.matches;
		};
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	const effectiveToolbarPosition = $derived.by(() => {
		if (
			isNarrow &&
			(toolbarPosition === "left" || toolbarPosition === "right")
		) {
			return "top";
		}
		return toolbarPosition;
	});

	const shouldRenderToolbar = $derived(
		coerceBooleanLike(showToolbar, false) &&
			effectiveToolbarPosition !== "none",
	);
	const toolbarBeforeContent = $derived(effectiveToolbarPosition === "top");
	const toolbarAfterContent = $derived(effectiveToolbarPosition === "bottom");
	const toolbarInline = $derived(
		effectiveToolbarPosition === "left" || effectiveToolbarPosition === "right",
	);
</script>

<div class={`pie-section-player-shell pie-section-player-shell--${effectiveToolbarPosition}`}>
	{#if shouldRenderToolbar && toolbarBeforeContent}
		<pie-section-toolbar
			class={`pie-section-player-toolbar pie-section-player-toolbar--${effectiveToolbarPosition}`}
			position={effectiveToolbarPosition}
			enabled-tools={enabledTools}
			{toolRegistry}
			hostButtons={sectionHostButtons}
		></pie-section-toolbar>
	{/if}

	<div
		class={`pie-section-player-layout-body ${
			shouldRenderToolbar && toolbarInline
				? `pie-section-player-layout-body--inline pie-section-player-layout-body--inline-${effectiveToolbarPosition}`
				: ""
		}`}
	>
		{#if shouldRenderToolbar && toolbarInline && effectiveToolbarPosition === "left"}
			<aside
				class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--left"
				aria-label="Section tools"
			>
				<pie-section-toolbar
					position="left"
					enabled-tools={enabledTools}
					{toolRegistry}
					hostButtons={sectionHostButtons}
				></pie-section-toolbar>
			</aside>
		{/if}

		<slot></slot>

		{#if shouldRenderToolbar && toolbarInline && effectiveToolbarPosition === "right"}
			<aside
				class="pie-section-player-toolbar-pane pie-section-player-toolbar-pane--right"
				aria-label="Section tools"
			>
				<pie-section-toolbar
					position="right"
					enabled-tools={enabledTools}
					{toolRegistry}
					hostButtons={sectionHostButtons}
				></pie-section-toolbar>
			</aside>
		{/if}
	</div>

	{#if shouldRenderToolbar && toolbarAfterContent}
		<pie-section-toolbar
			class={`pie-section-player-toolbar pie-section-player-toolbar--${effectiveToolbarPosition}`}
			position={effectiveToolbarPosition}
			enabled-tools={enabledTools}
			{toolRegistry}
			hostButtons={sectionHostButtons}
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
