<script lang="ts">
	/**
	 * A full-width slot on a content card that stacks whatever registered on it.
	 *
	 * A host slot, not a capability: this file names no capability, no support id
	 * and no element tag, so a host contributes one without a change here. What
	 * distinguishes it from the docked media region is geometry and nothing else —
	 * full width, in document flow, no divider — which is what a text alternate
	 * needs: it has to be *read*, in order, next to the content it belongs to,
	 * rather than watched beside it.
	 *
	 * Placement above the card content is the caller's choice, and it is what lets
	 * a transcript precede the audio control it transcribes without any element
	 * knowing about it.
	 */
	import { onDestroy } from "svelte";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		createToolSurfaceHost,
		type ToolSurfaceHostSnapshot,
	} from "@pie-players/pie-assessment-toolkit/tools/internal";

	let {
		regionId,
		surface,
		ownerContext,
		runtimeContext = null,
		toolRegistry = null,
	} = $props<{
		/** Stable id, so a caller can point `aria-controls`/`aria-describedby` here. */
		regionId: string;
		/** Host slot name this stack fills. */
		surface: string;
		ownerContext: CatalogOwnerContext;
		runtimeContext?: AssessmentToolkitRuntimeContext | null;
		toolRegistry?: ToolRegistry | null;
	}>();

	let anchor = $state<HTMLDivElement | null>(null);
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
			anchor,
			surface,
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

	/** In the DOM as soon as something is granted, so there is an anchor to mount into. */
	const stackMountable = $derived(surfaceSnapshot.mountable);
</script>

{#if stackMountable}
	<!-- Present once something is granted, but only taking up space once something
	     actually mounted: a grant plus resolved content is not yet a rendered
	     element, and `renderSurface` returning null is a legitimate answer. -->
	<div
		id={regionId}
		class="pie-section-player-card-surface-stack"
		data-region="surface-stack"
		data-pie-tool-surface={surface}
		data-occupied={surfaceSnapshot.occupied ? "" : undefined}
	>
		<div bind:this={anchor} class="pie-section-player-card-surface-stack-anchor"></div>
	</div>
{/if}

<style>
	.pie-section-player-card-surface-stack {
		padding: 1rem 1rem 0;
	}

	/* Granted but nothing mounted: in the DOM only to give the capability an
	   anchor, so it must not claim space or reach the accessibility tree. */
	.pie-section-player-card-surface-stack:not([data-occupied]) {
		display: none;
	}

	/* Layout-transparent, so a capability's element is a direct child of the
	   region and any height chain through it stays intact. */
	.pie-section-player-card-surface-stack-anchor {
		display: contents;
	}
</style>
