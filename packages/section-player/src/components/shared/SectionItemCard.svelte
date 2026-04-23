<svelte:options
	customElement={{
		tag: "pie-section-player-item-card",
		// Keep light DOM so hosted item-player output can inherit runtime/page styles.
		shadow: "none",
		props: {
			item: { type: "Object", reflect: false },
			itemIndex: { attribute: "item-index", type: "Number" },
			itemCount: { attribute: "item-count", type: "Number" },
			isCurrent: { attribute: "is-current", type: "Boolean", reflect: true },
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
		isCurrent = false,
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
		isCurrent?: boolean;
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
	// Stable id for aria-labelledby wiring between the host and the card heading.
	const headingId = `pie-section-player-item-card-heading-${
		item?.id ?? canonicalItemId ?? Math.random().toString(36).slice(2, 10)
	}`;
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
		// Public focus target: host is programmatically focusable (tabindex="-1")
		// but not in sequential tab order. The inner
		// `.pie-section-player-content-card[data-section-item-card]` remains as an
		// internal hook; public callers should target the custom element tag.
		if (!host.hasAttribute("tabindex")) host.setAttribute("tabindex", "-1");
		if (!host.hasAttribute("role")) host.setAttribute("role", "region");
		if (!host.hasAttribute("aria-labelledby")) {
			host.setAttribute("aria-labelledby", headingId);
		}
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
		aria-current={isCurrent ? "true" : undefined}
	>
		<div
			class="pie-section-player-content-card-header pie-section-player-item-header pie-section-player__item-header"
			data-region="header"
		>
			<h2 id={headingId}>{headerTitle}</h2>
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

	/* Public focus-visible treatment for the item card.
	   Scoped to the custom element tag so the outline wraps the whole card box,
	   not the inner heading or content. Hosts can override via --pie-focus-outline.
	   The inner `.pie-section-player-content-card[data-section-item-card]` is
	   an internal hook kept for back-compat with the old auto-focus path. */
	:global(pie-section-player-item-card) {
		display: block;
		border-radius: 8px;
	}

	:global(pie-section-player-item-card:focus) {
		outline: none;
	}

	:global(pie-section-player-item-card:focus-visible) {
		outline: 2px solid var(--pie-focus-outline, #1d4ed8);
		outline-offset: 2px;
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 8px;
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
		/* Header fill is intentionally transparent by default. Hosts/themes
		   opt-in to a solid color via --pie-section-player-card-header-background
		   (e.g. a brand Bluegreen tint) without this framework encoding a palette. */
		background: var(--pie-section-player-card-header-background, transparent);
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
