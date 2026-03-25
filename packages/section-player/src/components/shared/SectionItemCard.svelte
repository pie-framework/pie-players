<svelte:options
	customElement={{
		tag: "pie-section-player-item-card",
		// Keep light DOM so hosted item-player output can inherit runtime/page styles.
		shadow: "none",
		props: {
			item: { type: "Object", reflect: false },
			itemIndex: { attribute: "item-index", type: "Number" },
			itemCount: { attribute: "item-count", type: "Number" },
			canonicalItemId: { attribute: "canonical-item-id", type: "String" },
			resolvedPlayerTag: { attribute: "resolved-player-tag", type: "String" },
			playerAction: { type: "Object", reflect: false },
			playerParams: { attribute: "player-params", type: "Object", reflect: false },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import { onMount } from "svelte";
	import "../item-shell-element.js";
	import "@pie-players/pie-toolbars/components/item-toolbar-element";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
	import type { PlayerElementParams } from "./player-action.js";
	import {
		connectSectionPlayerCardRenderContext,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";

	let {
		item,
		itemIndex = 0,
		itemCount = 1,
		canonicalItemId,
		resolvedPlayerTag = "div",
		playerAction = (_node: HTMLElement, _params: PlayerElementParams) => undefined,
		playerParams,
		itemToolbarTools,
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
	} = $props<{
		item: ItemEntity;
		itemIndex?: number;
		itemCount?: number;
		canonicalItemId: string;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		itemToolbarTools: string;
		toolRegistry?: ToolRegistry | null;
		hostButtons?: ToolbarItem[];
	}>();

	let contextAnchor = $state<HTMLDivElement | null>(null);
	let contextResolvedPlayerTag = $state<string | null>(null);
	let contextPlayerAction = $state<
		((node: HTMLElement, params: PlayerElementParams) => unknown) | null
	>(null);
	let contextCardTitleFormatter = $state<SectionPlayerCardTitleFormatter | null>(null);
	let contextConnected = $state(false);
	// Context is the canonical source for shared render wiring while connected.
	// Props are explicit fallback when context is unavailable.
	const effectiveResolvedPlayerTag = $derived(
		(contextConnected ? contextResolvedPlayerTag : null) || resolvedPlayerTag,
	);
	const effectivePlayerAction = $derived(
		(contextConnected ? contextPlayerAction : null) || playerAction,
	);
	const itemPosition = $derived(
		Number.isFinite(itemIndex) ? Math.max(0, Number(itemIndex)) + 1 : 1,
	);
	const totalItems = $derived(Number.isFinite(itemCount) ? Math.max(1, Number(itemCount)) : 1);
	const defaultHeaderTitle = $derived(totalItems > 1 ? `Question ${itemPosition}` : "Question");
	const effectiveCardTitleFormatter = $derived(
		(contextConnected ? contextCardTitleFormatter : null) || null,
	);
	const headerTitle = $derived.by(() => {
		if (!effectiveCardTitleFormatter) return defaultHeaderTitle;
		try {
			const nextTitle = effectiveCardTitleFormatter({
				kind: "item",
				item,
				itemIndex: itemPosition - 1,
				itemCount: totalItems,
				canonicalItemId,
				defaultTitle: defaultHeaderTitle,
			});
			if (typeof nextTitle !== "string") return defaultHeaderTitle;
			const trimmedTitle = nextTitle.trim();
			return trimmedTitle || defaultHeaderTitle;
		} catch {
			return defaultHeaderTitle;
		}
	});

	function resetContextOverrides(): void {
		contextConnected = false;
		contextResolvedPlayerTag = null;
		contextPlayerAction = null;
		contextCardTitleFormatter = null;
	}

	function applyCardRenderContext(value: SectionPlayerCardRenderContext): void {
		if (!value || typeof value !== "object") return;
		if (typeof value.resolvedPlayerTag === "string" && value.resolvedPlayerTag.trim()) {
			contextResolvedPlayerTag = value.resolvedPlayerTag;
		}
		if (typeof value.playerAction === "function") {
			contextPlayerAction = value.playerAction;
		}
		if (typeof value.cardTitleFormatter === "function") {
			contextCardTitleFormatter = value.cardTitleFormatter;
		}
	}

	onMount(() => {
		const host = getHostElementFromAnchor(contextAnchor);
		if (!host) return;
		contextConnected = true;
		const disconnect = connectSectionPlayerCardRenderContext(
			host,
			applyCardRenderContext,
		);
		return () => {
			disconnect();
			resetContextOverrides();
		};
	});
</script>

<div bind:this={contextAnchor} class="pie-section-player-item-card-anchor" aria-hidden="true"></div>
<pie-item-shell
	item-id={item.id}
	canonical-item-id={canonicalItemId}
	content-kind="assessment-item"
	item={item}
>
	<div
		class="pie-section-player-content-card"
		tabindex="-1"
		data-section-item-card
		data-canonical-item-id={canonicalItemId}
	>
		<div
			class="pie-section-player-content-card-header pie-section-player-item-header pie-section-player__item-header"
			data-region="header"
		>
			<h2>{headerTitle}</h2>
			<pie-item-toolbar
				item-id={item.id}
				catalog-id={item.id}
				tools={itemToolbarTools}
				content-kind="assessment-item"
				size="md"
				language="en-US"
				{toolRegistry}
				{hostButtons}
			></pie-item-toolbar>
		</div>
		<div
			class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
			data-region="content"
		>
			<svelte:element
				this={effectiveResolvedPlayerTag}
				use:effectivePlayerAction={playerParams}
			></svelte:element>
		</div>
		<div data-region="footer"></div>
	</div>
</pie-item-shell>

<style>
	.pie-section-player-item-card-anchor {
		display: none;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
	}

	.pie-section-player-content-card-header h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header pie-item-toolbar {
		margin-left: auto;
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
		color: var(--pie-text, #111827);
	}
</style>
