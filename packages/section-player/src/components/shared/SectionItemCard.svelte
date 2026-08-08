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
		connectSectionPlayerCardRenderContext,
		getHostElementFromAnchor,
		type SectionPlayerCardRenderContext,
	} from "./section-player-card-context.js";
	import SectionCardSplitDivider from "./SectionCardSplitDivider.svelte";
	import SectionItemMediaRegion from "./SectionItemMediaRegion.svelte";
	import {
		clampMediaRegionPercent,
		MEDIA_REGION_DEFAULT_PERCENT,
		MEDIA_REGION_MAX_PERCENT,
		MEDIA_REGION_MIN_PERCENT,
		MEDIA_REGION_STACK_BREAKPOINT_PX,
		prepareSignLanguageItem,
		resolveSignLanguageAlternate,
		SIGN_LANGUAGE_FEATURE_ID,
		type ResolvedSignLanguageAlternate,
	} from "./section-item-media.js";

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
	// Catalog media region (signed alternates today, audio description next)
	// ------------------------------------------------------------------

	/**
	 * Inline signing video is lifted out of the item's content into catalog
	 * cards, so an item renders signing whether or not `accessibilityCatalogs`
	 * was populated upstream. Identity-preserving: an item with no signing
	 * markup comes back by reference, so nothing downstream sees churn.
	 */
	const prepared = $derived(prepareSignLanguageItem(item));
	const effectiveItem = $derived(prepared.item);
	// Only substitute the config when extraction actually changed it — the
	// item-player must not see a new object on every re-render.
	const effectivePlayerParams = $derived(
		prepared.item === item
			? playerParams
			: { ...playerParams, config: prepared.item.config },
	);

	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Bumped from the coordinator's policy-change stream so the eligibility
	// derivation reruns when policy inputs change (assessment binding, PNP
	// enforcement, custom sources). Same fanout pattern as `<pie-item-toolbar>`.
	let policyChangeVersion = $state(0);
	// Bumped from the coordinator's catalog-change stream, for the same reason
	// `policyChangeVersion` exists: the resolver is not reactive, so a `$derived`
	// reading it needs a signal when its contents change.
	let catalogChangeVersion = $state(0);
	let mediaRegionPercent = $state(MEDIA_REGION_DEFAULT_PERCENT);
	let mediaSplitContainer = $state<HTMLDivElement | null>(null);
	let mediaSplitWidthPx = $state(0);

	const mediaRegionId = $derived(`${headingId}-media`);

	/**
	 * Eligibility half of availability. A feature decision rather than a
	 * placement-scoped tool decision: the region is not a toolbar surface, so
	 * asking the placement question would answer "absent" for the wrong reason.
	 */
	const signLanguageDecision = $derived.by(() => {
		void policyChangeVersion;
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator || typeof coordinator.decideFeaturePolicy !== "function") {
			return null;
		}
		return coordinator.decideFeaturePolicy(SIGN_LANGUAGE_FEATURE_ID);
	});
	const signLanguageGranted = $derived(signLanguageDecision?.granted === true);
	/**
	 * Which sign language the learner is entitled to. Read from the feature's
	 * policy parameters (`toolParameters` / `toolConfigs`), never inferred from
	 * the item's content language — a Spanish item's signed alternate is LSM,
	 * not ASL.
	 */
	const requestedSignLang = $derived.by(() => {
		const parameters = signLanguageDecision?.parameters;
		if (parameters && typeof parameters === "object") {
			const candidate = (parameters as { signLang?: unknown }).signLang;
			if (typeof candidate === "string" && candidate.trim()) {
				return candidate.trim();
			}
		}
		return undefined;
	});

	// Built by the same function the runtime registers catalogs with, so the
	// lookup scope cannot drift from the registered one.
	const catalogOwnerContext = $derived.by((): CatalogOwnerContext =>
		catalogOwnerContextFor({
			kind: "item",
			itemId: effectiveItem?.id ?? "",
			canonicalItemId,
			assessmentId: runtimeContext?.assessmentId,
			sectionId: runtimeContext?.sectionId,
		}),
	);

	/**
	 * Content half of availability: the resolver has a matching card. Both halves
	 * are required and neither implies the other, so a learner with the
	 * accommodation still sees nothing on the vast majority of items.
	 */
	const resolvedMedia = $derived.by((): ResolvedSignLanguageAlternate | null => {
		void catalogChangeVersion;
		if (!signLanguageGranted) return null;
		const resolver = runtimeContext?.catalogResolver;
		if (!resolver || prepared.refs.length === 0) return null;
		return resolveSignLanguageAlternate({
			resolver,
			refs: prepared.refs,
			ownerContext: catalogOwnerContext,
			requestedSignLang,
		});
	});

	const mediaRegionVisible = $derived(resolvedMedia !== null);
	// Below the breakpoint the region stacks under the content, where a resize
	// handle has nothing to divide.
	const mediaRegionStacked = $derived(
		mediaSplitWidthPx > 0 && mediaSplitWidthPx < MEDIA_REGION_STACK_BREAKPOINT_PX,
	);
	const mediaDividerVisible = $derived(mediaRegionVisible && !mediaRegionStacked);
	const mediaSplitColumns = $derived(
		mediaDividerVisible
			? `minmax(0, ${100 - mediaRegionPercent}fr) auto minmax(0, ${mediaRegionPercent}fr)`
			: "minmax(0, 1fr)",
	);

	function onMediaRegionResize(next: number): void {
		mediaRegionPercent = clampMediaRegionPercent(next);
	}

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

	/**
	 * Item catalogs are registered by `<pie-assessment-toolkit>` in response to
	 * the item shell's registration event, which lands after this card mounts, so
	 * the first lookup legitimately misses. Re-resolve when the resolver says its
	 * catalog set changed — not on a timer: any retry budget is simultaneously too
	 * short for a slow element bundle and too long to be invisible, and running
	 * out of it strands the accommodation with no error.
	 */
	$effect(() => {
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator) return;
		const unsubscribe = coordinator.onCatalogsChange(() => {
			catalogChangeVersion += 1;
		});
		// Sync once on subscribe, because effects run after the DOM update that
		// mounted this card — and the item shell inside that subtree can register
		// its catalogs from `connectedCallback` during the very same update, before
		// this listener exists. Subscribing without re-resolving would miss exactly
		// the fast case. Safe against a loop: the effect writes this counter and
		// never reads it.
		catalogChangeVersion += 1;
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// Detach errors are non-fatal: the coordinator may already be gone.
			}
		};
	});

	$effect(() => {
		const container = mediaSplitContainer;
		if (!container || typeof ResizeObserver === "undefined") return;
		const update = () => {
			mediaSplitWidthPx = container.getBoundingClientRect().width;
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
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
	item-id={effectiveItem.id}
	canonical-item-id={canonicalItemId}
	content-kind="assessment-item"
	item={effectiveItem}
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
			<h2 id={headingId} data-pie-tool-overlay-protect>{headerTitle}</h2>
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
		<!-- The split wrapper is always present, and the content region always sits
		     in the same slot within it, so a signed alternate resolving after mount
		     adds siblings rather than re-creating the item player. -->
		<div
			class={`pie-section-player-item-card-split ${
				mediaRegionVisible ? "pie-section-player-item-card-split--with-media" : ""
			} ${mediaRegionStacked ? "pie-section-player-item-card-split--stacked" : ""}`}
			bind:this={mediaSplitContainer}
			style={`grid-template-columns: ${mediaSplitColumns};`}
		>
			<div
				class="pie-section-player-content-card-body pie-section-player-item-content pie-section-player__item-content"
				data-region="content"
			>
				<svelte:element
					this={effectiveResolvedPlayerTag}
					use:effectivePlayerAction={effectivePlayerParams}
				></svelte:element>
			</div>
			{#if mediaDividerVisible}
				<SectionCardSplitDivider
					value={mediaRegionPercent}
					min={MEDIA_REGION_MIN_PERCENT}
					max={MEDIA_REGION_MAX_PERCENT}
					container={mediaSplitContainer}
					ariaLabel="Resize question and media panels"
					ariaControls={mediaRegionId}
					ariaValueText={`${Math.round(mediaRegionPercent)}% media width`}
					onresize={onMediaRegionResize}
				/>
			{/if}
			{#if mediaRegionVisible && resolvedMedia}
				<div
					id={mediaRegionId}
					class="pie-section-player-item-card-media"
					data-region="media"
				>
					<SectionItemMediaRegion
						media={resolvedMedia}
						regionId={mediaRegionId}
						ttsService={runtimeContext?.ttsService ?? null}
					/>
				</div>
			{/if}
		</div>
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

	/* Question content and its docked catalog media, side by side. One column
	   until a media card resolves, so the content region keeps its position in
	   the layout either way. */
	.pie-section-player-item-card-split {
		display: grid;
		align-items: start;
		min-width: 0;
		min-height: 0;
	}

	.pie-section-player-item-card-split > * {
		min-width: 0;
		min-height: 0;
	}

	/* Below the stacking breakpoint the grid is single-column, so the media
	   region flows under the content instead of being squeezed beside it. */
	.pie-section-player-item-card-split--stacked {
		grid-template-columns: minmax(0, 1fr);
	}

	.pie-section-player-item-card-media {
		padding: 1rem 1rem 1rem 0;
	}

	.pie-section-player-item-card-split--stacked .pie-section-player-item-card-media {
		padding: 0 1rem 1rem;
	}

	/* Signing is re-checked while an answer is being formed, not read once
	   beforehand, so the recording follows a long question down the scroll
	   rather than disappearing above it. */
	.pie-section-player-item-card-split--with-media:not(.pie-section-player-item-card-split--stacked)
		.pie-section-player-item-card-media {
		position: sticky;
		top: 0;
		align-self: start;
	}
</style>
