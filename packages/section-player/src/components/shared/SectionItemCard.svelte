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
			// Composition context published by the pane: the level this card's own
			// heading occupies. The card renders it, and the item/passage player
			// beneath derives its outline from the same number — see
			// docs/architecture/composition-context.md.
			baseHeadingLevel: { attribute: "base-heading-level", type: "Number" },
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
	import { onMount, untrack } from "svelte";
	import "../item-shell-element.js";
	import "@pie-players/pie-assessment-toolkit/components/item-toolbar-element";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		catalogOwnerContextFor,
		connectAssessmentToolkitRuntimeContext,
	} from "@pie-players/pie-assessment-toolkit";
	import type { ItemEntity } from "@pie-players/pie-players-shared/types";
	import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
	import type { PlayerElementParams } from "./player-action.js";
	import {
		DEFAULT_SECTION_BASE_HEADING_LEVEL,
		normalizeBaseHeadingLevel,
	} from "./section-player-view-state.js";
	import {
		connectSectionPlayerCardRenderContext,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";
	import SectionCardMediaSplit from "./SectionCardMediaSplit.svelte";
	import SectionCardSurfaceStack from "./SectionCardSurfaceStack.svelte";
	import { CONTENT_LEAD_SURFACE } from "./card-media-region.js";

	let {
		item,
		itemIndex = 0,
		itemCount = 1,
		isCurrent = false,
		canonicalItemId,
		baseHeadingLevel = DEFAULT_SECTION_BASE_HEADING_LEVEL as number,
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
		baseHeadingLevel?: number;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		itemToolbarTools: string;
		toolRegistry?: ToolRegistry | null;
		hostButtons?: ToolbarItem[];
	}>();

	// Clamped here rather than trusted: the pane normalizes, but this card is a
	// custom element a host can drive directly, and an out-of-range level would
	// render an `<h0>`/`<h7>` that is not a heading at all.
	const resolvedHeadingLevel = $derived(
		normalizeBaseHeadingLevel(baseHeadingLevel),
	);

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
			`pie-section-player-item-card-heading-${
				item?.id ?? canonicalItemId ?? Math.random().toString(36).slice(2, 10)
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

	// ------------------------------------------------------------------
	// Docked media
	// ------------------------------------------------------------------
	//
	// The region itself lives in `SectionCardMediaSplit`, shared with the passage
	// card: an alternate is authored against a content node, and both card kinds
	// render content nodes. What differs is the owner scope of the lookup, which is
	// what this card supplies.

	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Bumped from the coordinator's policy-change stream so the eligibility
	// derivation reruns when policy inputs change (assessment binding, PNP
	// enforcement, custom sources). Same fanout pattern as `<pie-item-toolbar>`.
	let policyChangeVersion = $state(0);

	const mediaRegionId = $derived(`${headingId}-media`);
	const leadRegionId = $derived(`${headingId}-lead`);

	// Built by the same function the runtime registers catalogs with, so the
	// lookup scope cannot drift from the registered one.
	const catalogOwnerContext = $derived.by((): CatalogOwnerContext =>
		catalogOwnerContextFor({
			kind: "item",
			itemId: item?.id ?? "",
			canonicalItemId,
			assessmentId: runtimeContext?.assessmentId,
			sectionId: runtimeContext?.sectionId,
		}),
	);

	$effect(() => {
		if (!contextAnchor) return;
		return connectAssessmentToolkitRuntimeContext(contextAnchor, (value) => {
			runtimeContext = value;
		});
	});

	$effect(() => {
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator || typeof coordinator.onPolicyChange !== "function") return;
		const unsubscribe = coordinator.onPolicyChange(() => {
			policyChangeVersion += 1;
		});
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// Detach errors are non-fatal: the coordinator may already be gone.
			}
		};
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
		data-section-item-card
		data-canonical-item-id={canonicalItemId}
		data-pie-tool-overlay-boundary
		aria-current={isCurrent ? "true" : undefined}
	>
		<div
			class="pie-section-player-content-card-header pie-section-player-item-header pie-section-player__item-header"
			data-region="header"
		>
			<svelte:element
				this={`h${resolvedHeadingLevel}`}
				id={headingId}
				data-pie-tool-overlay-protect
			>{headerTitle}</svelte:element>
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
		<!-- Text alternates the capability set contributes, read in order before the
		     content: a transcript precedes the audio control it transcribes, and no
		     element has to know it exists. -->
		<SectionCardSurfaceStack
			regionId={leadRegionId}
			surface={CONTENT_LEAD_SURFACE}
			entity={item}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
			{policyChangeVersion}
		/>
		<SectionCardMediaSplit
			regionId={mediaRegionId}
			entity={item}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
			{policyChangeVersion}
			dividerAriaLabel="Resize question and media panels"
		>
			{#snippet content()}
				<div
					class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
					data-region="content"
				>
					<svelte:element
						this={effectiveResolvedPlayerTag}
						use:effectivePlayerAction={playerParams}
					></svelte:element>
				</div>
			{/snippet}
		</SectionCardMediaSplit>
		<div data-region="footer"></div>
	</div>
</pie-item-shell>

<style>
	.pie-section-player-item-card-anchor {
		display: none;
	}

	:global(pie-section-player-item-card) {
		display: block;
		border-radius: var(--pie-section-player-card-radius, 8px);
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: var(--pie-section-player-card-radius, 8px);
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-content-card-header {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		overflow: visible;
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);

		/* Header fill is intentionally transparent by default. Hosts/themes
		   opt-in to a solid color via --pie-section-player-card-header-background
		   (e.g. a brand Bluegreen tint) without this framework encoding a palette. */
		background: var(--pie-section-player-card-header-background, transparent);
		/* Default just inside the card radius to avoid a double-radius effect with the border. */
		border-top-left-radius: var(
			--pie-section-player-card-header-radius,
			calc(var(--pie-section-player-card-radius, 8px) - 1px)
		);
		border-top-right-radius: var(
			--pie-section-player-card-header-radius,
			calc(var(--pie-section-player-card-radius, 8px) - 1px)
		);
	}

	.pie-section-player-content-card-header h2 {
		position: relative;
		z-index: 0;
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		/* Default to the themed body text color so titles stay legible across
		   DaisyUI themes; --pie-header-text remains a host opt-in override. */
		color: var(--pie-header-text, var(--pie-text, #111827));
	}

	.pie-section-player-content-card-header pie-item-toolbar {
		position: relative;
		z-index: 1;
		margin-left: auto;
	}

	.pie-section-player-content-card-body {
		padding: 1rem;
		color: var(--pie-text, #111827);
	}

</style>
