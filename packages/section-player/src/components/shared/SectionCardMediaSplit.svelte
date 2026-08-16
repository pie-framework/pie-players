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
	import { onDestroy, type Snippet } from "svelte";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
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
	import {
		createToolSurfaceHost,
		type ToolSurfaceHostSnapshot,
	} from "@pie-players/pie-assessment-toolkit/tools/internal";

	let {
		regionId,
		ownerContext,
		runtimeContext = null,
		toolRegistry = null,
		dividerAriaLabel,
		dividerValueTextSuffix = "% media width",
		content,
	} = $props<{
		/** Id the resize handle points `aria-controls` at. */
		regionId: string;
		/** Owner scope for the catalog lookup, built by the toolkit's own helper. */
		ownerContext: CatalogOwnerContext;
		runtimeContext?: AssessmentToolkitRuntimeContext | null;
		toolRegistry?: ToolRegistry | null;
		dividerAriaLabel: string;
		dividerValueTextSuffix?: string;
		content: Snippet;
	}>();

	let mediaAnchor = $state<HTMLDivElement | null>(null);
	let mediaSplitContainer = $state<HTMLDivElement | null>(null);
	let mediaSplitWidthPx = $state(0);
	let mediaRegionPercent = $state(MEDIA_REGION_DEFAULT_PERCENT);
	let surfaceSnapshot = $state<ToolSurfaceHostSnapshot>({
		mountable: false,
		occupied: false,
	});
	const surfaceHost = createToolSurfaceHost(
		(next) => {
			surfaceSnapshot = next;
		},
		{ hostLabel: "pie-section-player" }
	);

	$effect(() => {
		surfaceHost.update({
			anchor: mediaAnchor,
			surface: CONTENT_MEDIA_SURFACE,
			registry: toolRegistry,
			services: {
				toolkitCoordinator: runtimeContext?.toolkitCoordinator ?? null,
				ttsService: runtimeContext?.ttsService ?? null,
				catalogResolver: runtimeContext?.catalogResolver ?? null,
			},
			scope: { kind: "content", ownerContext },
		});
	});

	onDestroy(() => surfaceHost.destroy());

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
	const mediaRegionMountable = $derived(surfaceSnapshot.mountable);
	/** Whether anything is in the region, which is what the layout follows. */
	const mediaRegionOccupied = $derived(surfaceSnapshot.occupied);
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
