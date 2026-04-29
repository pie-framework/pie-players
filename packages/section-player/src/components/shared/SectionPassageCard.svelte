<svelte:options
	customElement={{
		tag: "pie-section-player-passage-card",
		// Keep light DOM so hosted passage-player output can inherit runtime/page styles.
		shadow: "none",
		props: {
			passage: { type: "Object", reflect: false },
			resolvedPlayerTag: { attribute: "resolved-player-tag", type: "String" },
			playerAction: { type: "Object", reflect: false },
			playerParams: { attribute: "player-params", type: "Object", reflect: false },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			hostButtons: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import { onMount, untrack } from "svelte";
	import "../passage-shell-element.js";
	import "@pie-players/pie-toolbars/components/item-toolbar-element";
	import type {
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
	import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
	import type { PlayerElementParams } from "./player-action.js";
	import {
		connectSectionPlayerCardRenderContext,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";

	let {
		passage,
		resolvedPlayerTag = "div",
		playerAction = (_node: HTMLElement, _params: PlayerElementParams) => undefined,
		playerParams,
		passageToolbarTools,
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
	} = $props<{
		passage: PassageEntity;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		passageToolbarTools: string;
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
	const headingId = untrack(
		() =>
			`pie-section-player-passage-card-heading-${
				passage?.id ?? Math.random().toString(36).slice(2, 10)
			}`,
	);
	// Context is the canonical source for shared render wiring while connected.
	// Props are explicit fallback when context is unavailable.
	const effectiveResolvedPlayerTag = $derived(
		(contextConnected ? contextResolvedPlayerTag : null) || resolvedPlayerTag,
	);
	const effectivePlayerAction = $derived(
		(contextConnected ? contextPlayerAction : null) || playerAction,
	);
	const effectiveCardTitleFormatter = $derived(
		(contextConnected ? contextCardTitleFormatter : null) || null,
	);
	const headerTitle = $derived.by(() => {
		const defaultTitle = "Passage";
		if (!effectiveCardTitleFormatter) return defaultTitle;
		try {
			const nextTitle = effectiveCardTitleFormatter({
				kind: "passage",
				passage,
				defaultTitle,
			});
			if (typeof nextTitle !== "string") return defaultTitle;
			const trimmedTitle = nextTitle.trim();
			return trimmedTitle || defaultTitle;
		} catch {
			return defaultTitle;
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
		// but not in sequential tab order. Skip-to-Main and the auto-focus policy
		// move focus here. See README "Focus management".
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

<div bind:this={contextAnchor} class="pie-section-player-passage-card-anchor" aria-hidden="true"></div>
<pie-passage-shell
	item-id={passage.id}
	content-kind="rubric-block-stimulus"
	item={passage}
>
	<div class="pie-section-player-content-card">
		<div
			class="pie-section-player-content-card-header pie-section-player-passage-header pie-section-player__passage-header"
			data-region="header"
		>
			<h2 id={headingId}>{headerTitle}</h2>
			<pie-item-toolbar
				item-id={passage.id}
				catalog-id={passage.id}
				tools={passageToolbarTools}
				content-kind="rubric-block-stimulus"
				size="md"
				language="en-US"
				{toolRegistry}
				{hostButtons}
			></pie-item-toolbar>
		</div>
		<div
			class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
			data-region="content"
		>
			<svelte:element
				this={effectiveResolvedPlayerTag}
				use:effectivePlayerAction={playerParams}
			></svelte:element>
		</div>
	</div>
</pie-passage-shell>

<style>
	.pie-section-player-passage-card-anchor {
		display: none;
	}

	/* Public focus-visible treatment for the passage card.
	   Scoped to the custom element tag so the outline wraps the whole card box,
	   not the inner heading or content. Hosts can override via --pie-focus-outline. */
	:global(pie-section-player-passage-card) {
		display: block;
		border-radius: 8px;
	}

	:global(pie-section-player-passage-card:focus) {
		outline: none;
	}

	:global(pie-section-player-passage-card:focus-visible) {
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
