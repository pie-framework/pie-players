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
	import {
		clampMediaRegionPercent,
		MEDIA_REGION_DEFAULT_PERCENT,
		MEDIA_REGION_MAX_PERCENT,
		MEDIA_REGION_MIN_PERCENT,
		MEDIA_REGION_STACK_BREAKPOINT_PX,
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
	// Item media surface
	// ------------------------------------------------------------------

	/**
	 * A host slot, not a capability. Whatever registers on it renders here if
	 * policy grants it and its content dependency resolves; this file names no
	 * capability, no support id and no element tag, which is what lets a host
	 * contribute a docked accommodation without a change here. Which capabilities
	 * exist is the deployment's choice — see the package README.
	 *
	 * The card is never rewritten to produce that content: a docked alternate
	 * arrives as an authored or imported catalog, so the config handed to the item
	 * player is the one it was given.
	 */
	const ITEM_MEDIA_SURFACE = "item-media";

	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Bumped from the coordinator's policy-change stream so the eligibility
	// derivation reruns when policy inputs change (assessment binding, PNP
	// enforcement, custom sources). Same fanout pattern as `<pie-item-toolbar>`.
	let policyChangeVersion = $state(0);
	let mediaRegionPercent = $state(MEDIA_REGION_DEFAULT_PERCENT);
	let mediaSplitContainer = $state<HTMLDivElement | null>(null);
	let mediaSplitWidthPx = $state(0);

	const mediaRegionId = $derived(`${headingId}-media`);

	/** Capabilities that have declared themselves renderable in this slot. */
	const mediaSurfaceTools = $derived(
		toolRegistry?.getToolsBySurface?.(ITEM_MEDIA_SURFACE) ?? [],
	);

	/**
	 * Eligibility half of availability, per capability. A feature decision rather
	 * than a placement-scoped tool decision: the region is not a toolbar surface,
	 * so asking the placement question would answer "absent" for the wrong reason.
	 *
	 * The support id comes from the capability's own `pnpSupportIds`, so a host
	 * capability is gated by its own id with no list here to extend.
	 */
	function decideFeatureFor(supportId: string) {
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator || typeof coordinator.decideFeaturePolicy !== "function") {
			return null;
		}
		return coordinator.decideFeaturePolicy(supportId);
	}

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

	/**
	 * Content half of availability: the capability's own `requiresAuthoredContent`
	 * found what it needs. Both halves are required and neither implies the other,
	 * so a learner with an accommodation still sees nothing on the vast majority of
	 * items.
	 *
	 * State rather than `$derived`, and written only when the answer changes.
	 * The resolver is not reactive, so this has to be recomputed on a signal from
	 * it — and the obvious form of that, a version counter the `$derived` reads,
	 * invalidates on every signal whether or not the answer moved. That is a
	 * feedback loop here, not merely wasted work: re-rendering this card
	 * re-applies the `item` prop on `<pie-item-shell>`, whose registration effect
	 * re-runs and re-registers the item's catalogs, which makes the resolver emit
	 * again. One unconditional write per emission is all it takes to make that
	 * cycle self-sustaining, and Svelte aborts the update at its depth limit with
	 * the DOM half-applied. Comparing before writing breaks the cycle at the only
	 * point where it can be broken without either side knowing about the other.
	 */
	type GrantedMediaCapability = {
		toolId: string;
		featureId: string;
		parameters?: unknown;
		content: unknown;
	};
	let grantedMediaCapabilities = $state<GrantedMediaCapability[]>([]);
	/** Signature of what is in `grantedMediaCapabilities`; not reactive. */
	let grantedMediaSignature = "";

	function computeGrantedMediaCapabilities(): GrantedMediaCapability[] {
		const granted: GrantedMediaCapability[] = [];
		for (const tool of mediaSurfaceTools) {
			// A capability declares which support ids grant it; any one is enough.
			const supportIds = tool.pnpSupportIds?.length
				? tool.pnpSupportIds
				: [tool.toolId];
			let decision: ReturnType<typeof decideFeatureFor> = null;
			let featureId = "";
			for (const supportId of supportIds) {
				const candidate = decideFeatureFor(supportId);
				if (candidate?.granted === true) {
					decision = candidate;
					featureId = supportId;
					break;
				}
			}
			if (!decision) continue;

			// A capability with no content dependency needs only the grant.
			let content: unknown = null;
			if (tool.requiresAuthoredContent) {
				try {
					content = tool.requiresAuthoredContent.resolve({
						featureId,
						parameters: decision.parameters,
						catalogResolver: runtimeContext?.catalogResolver ?? null,
						ownerContext: catalogOwnerContext,
						item,
					});
				} catch {
					// A capability that throws while looking for its content is absent,
					// not fatal to the card.
					content = null;
				}
				if (content === null || content === undefined) continue;
			}
			granted.push({
				toolId: tool.toolId,
				featureId,
				parameters: decision.parameters,
				content,
			});
		}
		return granted;
	}

	function syncGrantedMediaCapabilities(): void {
		const next = computeGrantedMediaCapabilities();
		// Structural, not by identity: every resolution builds fresh objects, so
		// identity would report a change on every call and defeat the guard.
		const signature = next.length > 0 ? JSON.stringify(next) : "";
		if (signature === grantedMediaSignature) return;
		grantedMediaSignature = signature;
		grantedMediaCapabilities = next;
	}

	// Policy, the registered surface set and the item are reactive, so reading them
	// through `computeGrantedMediaCapabilities` is what re-resolves when they move.
	$effect(() => {
		void policyChangeVersion;
		void mediaSurfaceTools;
		void item;
		syncGrantedMediaCapabilities();
	});

	const mediaRegionVisible = $derived(grantedMediaCapabilities.length > 0);
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
		// `untrack` so resolving does not add its own inputs to this effect's
		// dependencies. Policy, eligibility and the item's refs all belong to the
		// effect above; tracking them here too would tear down and re-establish the
		// subscription every time any of them moved.
		const unsubscribe = coordinator.onCatalogsChange(() =>
			untrack(syncGrantedMediaCapabilities),
		);
		// Resolve once on subscribe, because effects run after the DOM update that
		// mounted this card — and the item shell inside that subtree can register
		// its catalogs from `connectedCallback` during the very same update, before
		// this listener exists. Subscribing without re-resolving would miss exactly
		// the fast case.
		untrack(syncGrantedMediaCapabilities);
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// Detach errors are non-fatal: the coordinator may already be gone.
			}
		};
	});

	/**
	 * Mount each granted capability's element into the region.
	 *
	 * Imperative rather than a `{#each}` of components, because what renders is a
	 * host-registered element this package must not import. Reconciled by toolId so
	 * a re-resolve reapplies props through `sync` instead of tearing the element
	 * down — a `<video>` recreated mid-playback would restart the recording.
	 */
	let mediaAnchor = $state<HTMLDivElement | null>(null);
	const mountedMediaTools = new Map<
		string,
		{ element: HTMLElement; sync?: () => void; destroy?: () => void }
	>();

	$effect(() => {
		const anchor = mediaAnchor;
		const granted = grantedMediaCapabilities;
		const registry = toolRegistry;
		if (!anchor || !registry) return;

		untrack(() => {
			const wanted = new Set(granted.map((entry) => entry.toolId));
			for (const [toolId, mounted] of [...mountedMediaTools]) {
				if (wanted.has(toolId)) continue;
				try {
					mounted.destroy?.();
				} catch {
					// A capability that throws on teardown must not strand the element.
				}
				mounted.element.remove();
				mountedMediaTools.delete(toolId);
			}

			for (const entry of granted) {
				const existing = mountedMediaTools.get(entry.toolId);
				if (existing) {
					try {
						existing.sync?.();
					} catch {
						// A failed reapply leaves the element as it was, which is better
						// than removing a region the learner is watching.
					}
					continue;
				}
				let rendered: ReturnType<typeof registry.renderForSurface> = null;
				try {
					rendered = registry.renderForSurface(entry.toolId, {
						toolId: entry.toolId,
						featureId: entry.featureId,
						surface: ITEM_MEDIA_SURFACE,
						parameters: entry.parameters,
						content: entry.content,
						services: {
							toolkitCoordinator: runtimeContext?.toolkitCoordinator ?? null,
							ttsService: runtimeContext?.ttsService ?? null,
							catalogResolver: runtimeContext?.catalogResolver ?? null,
						},
					});
				} catch {
					rendered = null;
				}
				if (!rendered?.element) continue;
				if (rendered.ariaLabel) {
					rendered.element.setAttribute("aria-label", rendered.ariaLabel);
				}
				anchor.appendChild(rendered.element);
				mountedMediaTools.set(entry.toolId, {
					element: rendered.element,
					sync: rendered.sync,
					destroy: rendered.destroy,
				});
			}
		});
	});

	$effect(() => {
		return () => {
			for (const mounted of mountedMediaTools.values()) {
				try {
					mounted.destroy?.();
				} catch {
					// Teardown errors are non-fatal while the card is going away.
				}
				mounted.element.remove();
			}
			mountedMediaTools.clear();
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
		     in the same slot within it, so a docked alternate resolving after mount
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
					use:effectivePlayerAction={playerParams}
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
			{#if mediaRegionVisible}
				<div
					id={mediaRegionId}
					class="pie-section-player-item-card-media"
					data-region="media"
				>
					<div bind:this={mediaAnchor} data-pie-tool-surface={ITEM_MEDIA_SURFACE}></div>
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

	/* A docked alternate is consulted while an answer is being formed, not read
	   once beforehand, so it follows a long question down the scroll rather than
	   disappearing above it. */
	.pie-section-player-item-card-split--with-media:not(.pie-section-player-item-card-split--stacked)
		.pie-section-player-item-card-media {
		position: sticky;
		top: 0;
		align-self: start;
	}
</style>
