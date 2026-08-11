<script lang="ts">
	/**
	 * A content card's body beside its docked media region.
	 *
	 * Shared by the item card and the passage card because the question it answers
	 * is the same in both: policy granted a media capability, the capability found
	 * authored content for *this* entity, so the card gives it a column beside the
	 * content it interprets. Only the owner scope of the lookup differs, and that
	 * arrives as a prop.
	 *
	 * A host slot, not a capability. Whatever registers on the surface renders here
	 * if policy grants it and its content dependency resolves; this file names no
	 * capability, no support id and no element tag, which is what lets a host
	 * contribute a docked accommodation without a change here.
	 *
	 * The card is never rewritten to produce that content: a docked alternate
	 * arrives as an authored or imported catalog, so the config handed to the item
	 * or passage player is the one it was given.
	 */
	import { untrack, type Snippet } from "svelte";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
		ToolSurfaceRenderContext,
	} from "@pie-players/pie-assessment-toolkit";
	import SectionCardSplitDivider from "./SectionCardSplitDivider.svelte";
	import {
		clampMediaRegionPercent,
		CONTENT_MEDIA_SURFACE,
		MEDIA_REGION_DEFAULT_PERCENT,
		MEDIA_REGION_MAX_PERCENT,
		MEDIA_REGION_MIN_PERCENT,
		MEDIA_REGION_STACK_BREAKPOINT_PX,
	} from "./card-media-region.js";

	let {
		regionId,
		entity,
		ownerContext,
		runtimeContext = null,
		toolRegistry = null,
		policyChangeVersion = 0,
		dividerAriaLabel,
		dividerValueTextSuffix = "% media width",
		content,
	} = $props<{
		/** Id the resize handle points `aria-controls` at. */
		regionId: string;
		/** The entity a capability resolves its authored content against. */
		entity: unknown;
		/** Owner scope for the catalog lookup, built by the toolkit's own helper. */
		ownerContext: CatalogOwnerContext;
		runtimeContext?: AssessmentToolkitRuntimeContext | null;
		toolRegistry?: ToolRegistry | null;
		/** Bumped by the card from the coordinator's policy-change stream. */
		policyChangeVersion?: number;
		dividerAriaLabel: string;
		dividerValueTextSuffix?: string;
		content: Snippet;
	}>();

	let mediaAnchor = $state<HTMLDivElement | null>(null);
	let mediaSplitContainer = $state<HTMLDivElement | null>(null);
	let mediaSplitWidthPx = $state(0);
	let mediaRegionPercent = $state(MEDIA_REGION_DEFAULT_PERCENT);
	/**
	 * How many capabilities actually mounted, which is what the region's own
	 * visibility follows. A grant plus resolved content is not yet a rendered
	 * element: `renderSurface` returning `null` is a legitimate answer — a host that
	 * remapped the element tag to one it never defined takes that path — and driving
	 * the layout from the grant instead left an empty 34% column with a focusable
	 * resize handle dividing nothing.
	 */
	let mountedMediaCount = $state(0);

	/** Capabilities that have declared themselves renderable in this slot. */
	const mediaSurfaceTools = $derived(
		toolRegistry?.getToolsBySurface?.(CONTENT_MEDIA_SURFACE) ?? [],
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
	 * feedback loop here, not merely wasted work: re-rendering the card re-applies
	 * the entity prop on its shell, whose registration effect re-runs and
	 * re-registers the entity's catalogs, which makes the resolver emit again. One
	 * unconditional write per emission is all it takes to make that cycle
	 * self-sustaining, and Svelte aborts the update at its depth limit with the DOM
	 * half-applied. Comparing before writing breaks the cycle at the only point
	 * where it can be broken without either side knowing about the other.
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
			let resolved: unknown = null;
			if (tool.requiresAuthoredContent) {
				try {
					resolved = tool.requiresAuthoredContent.resolve({
						featureId,
						parameters: decision.parameters,
						catalogResolver: runtimeContext?.catalogResolver ?? null,
						ownerContext,
						item: entity,
					});
				} catch {
					// A capability that throws while looking for its content is absent,
					// not fatal to the card.
					resolved = null;
				}
				if (resolved === null || resolved === undefined) continue;
			}
			granted.push({
				toolId: tool.toolId,
				featureId,
				parameters: decision.parameters,
				content: resolved,
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

	// Policy, the registered surface set, the entity and its owner scope are
	// reactive, so reading them through `computeGrantedMediaCapabilities` is what
	// re-resolves when they move.
	$effect(() => {
		void policyChangeVersion;
		void mediaSurfaceTools;
		void entity;
		void ownerContext;
		syncGrantedMediaCapabilities();
	});

	/**
	 * Catalogs are registered by `<pie-assessment-toolkit>` in response to the
	 * shell's registration event, which lands after this card mounts, so the first
	 * lookup legitimately misses. Re-resolve when the resolver says its catalog set
	 * changed — not on a timer: any retry budget is simultaneously too short for a
	 * slow element bundle and too long to be invisible, and running out of it
	 * strands the accommodation with no error.
	 */
	$effect(() => {
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator || typeof coordinator.onCatalogsChange !== "function") return;
		// `untrack` so resolving does not add its own inputs to this effect's
		// dependencies. Policy, eligibility and the entity's refs all belong to the
		// effect above; tracking them here too would tear down and re-establish the
		// subscription every time any of them moved.
		const unsubscribe = coordinator.onCatalogsChange(() =>
			untrack(syncGrantedMediaCapabilities),
		);
		// Resolve once on subscribe, because effects run after the DOM update that
		// mounted this card — and the shell inside that subtree can register its
		// catalogs from `connectedCallback` during the very same update, before this
		// listener exists. Subscribing without re-resolving would miss exactly the
		// fast case.
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
	const mountedMediaTools = new Map<
		string,
		{
			element: HTMLElement;
			sync?: (context: ToolSurfaceRenderContext) => void;
			destroy?: () => void;
		}
	>();
	/**
	 * Tool ids whose custom-element module is present. A capability stays unmounted
	 * until its module resolves, so a lazily-registered one renders rather than
	 * silently missing its element; `ensureToolModuleLoaded` resolves immediately
	 * for a capability that registered its element eagerly, so this costs those a
	 * microtask and nothing else.
	 */
	let loadedMediaModules = $state<string[]>([]);

	$effect(() => {
		const registry = toolRegistry;
		if (!registry || typeof registry.ensureToolModuleLoaded !== "function") return;
		const pending = grantedMediaCapabilities
			.map((entry) => entry.toolId)
			.filter((toolId) => !loadedMediaModules.includes(toolId));
		if (pending.length === 0) return;
		let cancelled = false;
		for (const toolId of pending) {
			void registry
				.ensureToolModuleLoaded(toolId)
				.then(() => {
					if (cancelled) return;
					loadedMediaModules = [...loadedMediaModules, toolId];
				})
				.catch((error: unknown) => {
					console.error(
						`[pie-section-player] tool "${toolId}" failed to load its module for the "${CONTENT_MEDIA_SURFACE}" surface`,
						error,
					);
				});
		}
		return () => {
			cancelled = true;
		};
	});

	/**
	 * What the host tells the capability, rebuilt per mount and per re-sync.
	 *
	 * Rebuilt rather than captured: `sync` exists so a re-resolve reaches an element
	 * already on screen, and handing it the context from first mount would re-apply
	 * the values it already has.
	 */
	function mediaSurfaceContext(
		entry: GrantedMediaCapability,
	): ToolSurfaceRenderContext {
		return {
			toolId: entry.toolId,
			featureId: entry.featureId,
			surface: CONTENT_MEDIA_SURFACE,
			parameters: entry.parameters,
			content: entry.content,
			services: {
				toolkitCoordinator: runtimeContext?.toolkitCoordinator ?? null,
				ttsService: runtimeContext?.ttsService ?? null,
				catalogResolver: runtimeContext?.catalogResolver ?? null,
			},
		};
	}

	function unmountMediaTool(toolId: string): void {
		const mounted = mountedMediaTools.get(toolId);
		if (!mounted) return;
		mountedMediaTools.delete(toolId);
		try {
			mounted.destroy?.();
		} catch {
			// A capability that throws on teardown must not strand the element.
		}
		mounted.element.remove();
		mountedMediaCount = mountedMediaTools.size;
	}

	$effect(() => {
		const anchor = mediaAnchor;
		const granted = grantedMediaCapabilities;
		const registry = toolRegistry;
		const loaded = loadedMediaModules;
		if (!anchor || !registry) {
			// The anchor lives inside the region, so losing the last grant destroys it
			// — and returning here instead of tearing down left the elements detached
			// but alive (a `<video>` keeps playing audio) and kept their entries in the
			// map, so the next grant found an "existing" mount that was no longer in
			// the document and the region stayed empty for the rest of the session.
			untrack(() => {
				for (const toolId of [...mountedMediaTools.keys()]) unmountMediaTool(toolId);
			});
			return;
		}

		untrack(() => {
			const mountable = granted.filter((entry) => loaded.includes(entry.toolId));
			const wanted = new Set(mountable.map((entry) => entry.toolId));
			for (const toolId of [...mountedMediaTools.keys()]) {
				if (!wanted.has(toolId)) unmountMediaTool(toolId);
			}

			for (const entry of mountable) {
				const existing = mountedMediaTools.get(entry.toolId);
				if (existing) {
					try {
						existing.sync?.(mediaSurfaceContext(entry));
					} catch {
						// A failed reapply leaves the element as it was, which is better
						// than removing a region the learner is watching.
					}
					continue;
				}
				let rendered: ReturnType<typeof registry.renderForSurface> = null;
				try {
					rendered = registry.renderForSurface(
						entry.toolId,
						mediaSurfaceContext(entry),
					);
				} catch (error) {
					console.error(
						`[pie-section-player] tool "${entry.toolId}" failed to render into the "${CONTENT_MEDIA_SURFACE}" surface`,
						error,
					);
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
				mountedMediaCount = mountedMediaTools.size;
			}
		});
	});

	$effect(() => {
		return () => {
			for (const toolId of [...mountedMediaTools.keys()]) unmountMediaTool(toolId);
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

	/**
	 * Whether the region exists in the DOM, so a granted capability has an anchor to
	 * mount into. Not the same question as whether the region takes up space — see
	 * `mediaRegionOccupied`.
	 */
	const mediaRegionMountable = $derived(grantedMediaCapabilities.length > 0);
	/** Whether anything is in the region, which is what the layout follows. */
	const mediaRegionOccupied = $derived(mountedMediaCount > 0);
	// Below the breakpoint the region stacks under the content, where a resize
	// handle has nothing to divide.
	const mediaRegionStacked = $derived(
		mediaSplitWidthPx > 0 && mediaSplitWidthPx < MEDIA_REGION_STACK_BREAKPOINT_PX,
	);
	const mediaDividerVisible = $derived(mediaRegionOccupied && !mediaRegionStacked);
	const mediaSplitColumns = $derived(
		mediaDividerVisible
			? `minmax(0, ${100 - mediaRegionPercent}fr) auto minmax(0, ${mediaRegionPercent}fr)`
			: "minmax(0, 1fr)",
	);

	function onMediaRegionResize(next: number): void {
		mediaRegionPercent = clampMediaRegionPercent(next);
	}
</script>

<!-- The split wrapper is always present, and the content region always sits in
     the same slot within it, so a docked alternate resolving after mount adds
     siblings rather than re-creating the player. -->
<div
	class={`pie-section-player-card-media-split ${
		mediaRegionOccupied ? "pie-section-player-card-media-split--with-media" : ""
	} ${mediaRegionStacked ? "pie-section-player-card-media-split--stacked" : ""}`}
	bind:this={mediaSplitContainer}
	style={`grid-template-columns: ${mediaSplitColumns};`}
>
	{@render content()}
	{#if mediaDividerVisible}
		<SectionCardSplitDivider
			value={mediaRegionPercent}
			min={MEDIA_REGION_MIN_PERCENT}
			max={MEDIA_REGION_MAX_PERCENT}
			container={mediaSplitContainer}
			ariaLabel={dividerAriaLabel}
			ariaControls={regionId}
			ariaValueText={`${Math.round(mediaRegionPercent)}${dividerValueTextSuffix}`}
			onresize={onMediaRegionResize}
		/>
	{/if}
	{#if mediaRegionMountable}
		<!-- Present as soon as something is granted, so there is an anchor to mount
		     into, but it only takes up space once something actually mounted:
		     `data-occupied` is what the stylesheet below keys on. -->
		<div
			id={regionId}
			class="pie-section-player-card-media"
			data-region="media"
			data-occupied={mediaRegionOccupied ? "" : undefined}
		>
			<div
				bind:this={mediaAnchor}
				class="pie-section-player-card-media-surface"
				data-pie-tool-surface={CONTENT_MEDIA_SURFACE}
			></div>
		</div>
	{/if}
</div>

<style>
	/* Content and its docked catalog media, side by side. One column until a media
	   card resolves, so the content region keeps its position in the layout either
	   way. */
	.pie-section-player-card-media-split {
		display: grid;
		align-items: start;
		min-width: 0;
		min-height: 0;
	}

	/* `:global` because the content body is authored by the card and arrives here
	   as a snippet, so it carries the card's scoping rather than this component's. */
	.pie-section-player-card-media-split > :global(*) {
		min-width: 0;
		min-height: 0;
	}

	/* Below the stacking breakpoint the grid is single-column, so the media region
	   flows under the content instead of being squeezed beside it. */
	.pie-section-player-card-media-split--stacked {
		grid-template-columns: minmax(0, 1fr);
	}

	.pie-section-player-card-media {
		padding: 1rem 1rem 1rem 0;
	}

	/* Granted but nothing mounted: the region is in the DOM only to give the
	   capability an anchor, so it must not claim a grid column or reach the
	   accessibility tree. */
	.pie-section-player-card-media:not([data-occupied]) {
		display: none;
	}

	/* Layout-transparent, so the capability's element is a direct child of the
	   region as it was before the region became a host surface. An anchor that
	   generated its own box broke any `height: 100%` chain through it, and the
	   sizing tokens hosts set on the region are being tested against that chain. */
	.pie-section-player-card-media-surface {
		display: contents;
	}

	.pie-section-player-card-media-split--stacked .pie-section-player-card-media {
		padding: 0 1rem 1rem;
	}

	/* A docked alternate is consulted while an answer is being formed, not read
	   once beforehand, so it follows long content down the scroll rather than
	   disappearing above it. */
	.pie-section-player-card-media-split--with-media:not(
			.pie-section-player-card-media-split--stacked
		)
		.pie-section-player-card-media {
		position: sticky;
		top: 0;
		align-self: start;
	}
</style>
