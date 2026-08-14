<svelte:options
	customElement={{
		tag: "pie-section-player-passage-card",
		// Keep light DOM so hosted passage-player output can inherit runtime/page styles.
		shadow: "none",
		props: {
			passage: { type: "Object", reflect: false },
			// Composition context published by the pane: the level this card's own
			// heading occupies. The card renders it, and the item/passage player
			// beneath derives its outline from the same number — see
			// docs/architecture/composition-context.md.
			baseHeadingLevel: { attribute: "base-heading-level", type: "Number" },
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
	import type { PassageEntity } from "@pie-players/pie-players-shared/types";
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
		passage,
		baseHeadingLevel = DEFAULT_SECTION_BASE_HEADING_LEVEL as number,
		resolvedPlayerTag = "div",
		playerAction = (_node: HTMLElement, _params: PlayerElementParams) => undefined,
		playerParams,
		passageToolbarTools,
		toolRegistry = null as ToolRegistry | null,
		hostButtons = [] as ToolbarItem[],
	} = $props<{
		passage: PassageEntity;
		baseHeadingLevel?: number;
		resolvedPlayerTag?: string;
		playerAction?: (node: HTMLElement, params: PlayerElementParams) => unknown;
		playerParams: PlayerElementParams;
		passageToolbarTools: string;
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

	// ------------------------------------------------------------------
	// Docked media
	// ------------------------------------------------------------------
	//
	// A passage owns content nodes, so it carries alternates for them exactly as an
	// item does — a signed reading of a shared passage is authored once, against the
	// passage. The region is `SectionCardMediaSplit`, shared with the item card; this
	// card differs only in the owner scope it looks catalogs up under, which is the
	// same scope `<pie-passage-shell>` registered them in.

	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);

	const mediaRegionId = $derived(`${headingId}-media`);
	const leadRegionId = $derived(`${headingId}-lead`);

	// Built by the same function the runtime registers catalogs with, so the lookup
	// scope cannot drift from the registered one.
	const catalogOwnerContext = $derived.by((): CatalogOwnerContext =>
		catalogOwnerContextFor({
			kind: "passage",
			itemId: passage?.id ?? "",
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

<div bind:this={contextAnchor} class="pie-section-player-passage-card-anchor" aria-hidden="true"></div>
<pie-passage-shell
	item-id={passage.id}
	content-kind="rubric-block-stimulus"
	item={passage}
>
	<div class="pie-section-player-content-card" data-pie-tool-overlay-boundary>
		<div
			class="pie-section-player-content-card-header pie-section-player-passage-header pie-section-player__passage-header"
			data-region="header"
		>
			<svelte:element
				this={`h${resolvedHeadingLevel}`}
				id={headingId}
				data-pie-tool-overlay-protect
			>{headerTitle}</svelte:element>
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
		<!-- Text alternates the capability set contributes, read in order before the
		     content: a transcript precedes the audio control it transcribes, and no
		     element has to know it exists. -->
		<SectionCardSurfaceStack
			regionId={leadRegionId}
			surface={CONTENT_LEAD_SURFACE}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
		/>
		<SectionCardMediaSplit
			regionId={mediaRegionId}
			ownerContext={catalogOwnerContext}
			{runtimeContext}
			{toolRegistry}
			dividerAriaLabel="Resize passage and media panels"
		>
			{#snippet content()}
				<div
					class="pie-section-player-content-card-body pie-section-player-passage-content pie-section-player__passage-content"
					data-region="content"
				>
					<svelte:element
						this={effectiveResolvedPlayerTag}
						use:effectivePlayerAction={playerParams}
					></svelte:element>
				</div>
			{/snippet}
		</SectionCardMediaSplit>
	</div>
</pie-passage-shell>

<style>
	.pie-section-player-passage-card-anchor {
		display: none;
	}

	:global(pie-section-player-passage-card) {
		display: block;
		border-radius: var(--pie-section-player-card-radius, 8px);
		/* Bridge for the hosted passage-player custom element, which reads its
		   own --pie-passage-header-background token and lives outside this
		   package's control. Resolving it here keeps the passage header in
		   sync with the section-player card header without either side
		   hardcoding the other's token name. */
		--pie-passage-header-background: var(--pie-section-player-card-header-background);
	}

	.pie-section-player-content-card {
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: var(--pie-section-player-card-radius, 8px);
		background: var(--pie-background, #fff);
		color: var(--pie-text, #111827);
	}

	:global(pie-section-player-passage-card .pie-section-player-content-card:has(.pie-section-player-passage-content :focus-visible)) {
		outline: 3px solid var(--pie-section-player-focus-outline, var(--pie-focus-outline, #146eb3));
		outline-offset: 2px;
	}

	/* Multi-passage sets render their own tab strip (role="tablist") as the
	   first thing inside the body, which already reads as a header. Drop the
	   gap and duplicate rule above it so the two headers blend into one band;
	   a single passage has no tablist and keeps the default spacing. */
	:global(pie-section-player-passage-card .pie-section-player-content-card:has(.pie-section-player-content-card-body [role="tablist"]) .pie-section-player-content-card-header) {
		border-bottom: none;
	}

	:global(pie-section-player-passage-card .pie-section-player-content-card:has(.pie-section-player-content-card-body [role="tablist"]) .pie-section-player-content-card-body) {
		padding: 0 0 1rem;
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
