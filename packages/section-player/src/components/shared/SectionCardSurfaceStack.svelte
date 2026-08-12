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
	import { untrack } from "svelte";
	import type {
		AssessmentToolkitRuntimeContext,
		CatalogOwnerContext,
		ToolRegistry,
		ToolSurfaceRenderContext,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		resolveSurfaceCapabilities,
		type GrantedSurfaceCapability,
	} from "./card-surface-capabilities.js";

	let {
		regionId,
		surface,
		entity,
		ownerContext,
		runtimeContext = null,
		toolRegistry = null,
		policyChangeVersion = 0,
	} = $props<{
		/** Stable id, so a caller can point `aria-controls`/`aria-describedby` here. */
		regionId: string;
		/** Host slot name this stack fills. */
		surface: string;
		/** The entity a capability resolves its authored content against. */
		entity: unknown;
		ownerContext: CatalogOwnerContext;
		runtimeContext?: AssessmentToolkitRuntimeContext | null;
		toolRegistry?: ToolRegistry | null;
		/** Bumped by the card from the coordinator's policy-change stream. */
		policyChangeVersion?: number;
	}>();

	let anchor = $state<HTMLDivElement | null>(null);
	let mountedCount = $state(0);

	const surfaceTools = $derived(toolRegistry?.getToolsBySurface?.(surface) ?? []);

	/**
	 * State rather than `$derived`, written only when the answer changes.
	 *
	 * The resolver is not reactive, so this is recomputed on its change signal —
	 * and an unconditional write per signal is a feedback loop, not merely wasted
	 * work: re-rendering the card re-applies the entity prop on its shell, whose
	 * registration effect re-registers the entity's catalogs, which makes the
	 * resolver emit again. Comparing before writing breaks the cycle at the only
	 * point where neither side has to know about the other.
	 */
	let granted = $state<GrantedSurfaceCapability[]>([]);
	let grantedSignature = "";

	function syncGranted(): void {
		const next = resolveSurfaceCapabilities({
			tools: surfaceTools,
			decideFeature: (supportId) => {
				const coordinator = runtimeContext?.toolkitCoordinator;
				if (!coordinator || typeof coordinator.decideFeaturePolicy !== "function") {
					return null;
				}
				return coordinator.decideFeaturePolicy(supportId);
			},
			catalogResolver: runtimeContext?.catalogResolver ?? null,
			ownerContext,
			entity,
		});
		// Structural, not by identity: every resolution builds fresh objects.
		const signature = next.length > 0 ? JSON.stringify(next) : "";
		if (signature === grantedSignature) return;
		grantedSignature = signature;
		granted = next;
	}

	$effect(() => {
		void policyChangeVersion;
		void surfaceTools;
		void entity;
		void ownerContext;
		syncGranted();
	});

	/**
	 * Catalogs are registered in response to the shell's registration event, which
	 * lands after this card mounts, so the first lookup legitimately misses.
	 * Re-resolve when the resolver says its catalog set changed — not on a timer:
	 * any retry budget is at once too short for a slow element bundle and too long
	 * to be invisible, and running out of it strands the accommodation silently.
	 */
	$effect(() => {
		const coordinator = runtimeContext?.toolkitCoordinator;
		if (!coordinator || typeof coordinator.onCatalogsChange !== "function") return;
		const unsubscribe = coordinator.onCatalogsChange(() => untrack(syncGranted));
		untrack(syncGranted);
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// Detach errors are non-fatal: the coordinator may already be gone.
			}
		};
	});

	/**
	 * Tool ids whose element module is present. A capability stays unmounted until
	 * its module resolves, so a lazily-registered one renders rather than silently
	 * missing its element.
	 */
	let loadedModules = $state<string[]>([]);

	$effect(() => {
		const registry = toolRegistry;
		if (!registry || typeof registry.ensureToolModuleLoaded !== "function") return;
		const pending = granted
			.map((entry) => entry.toolId)
			.filter((toolId) => !loadedModules.includes(toolId));
		if (pending.length === 0) return;
		let cancelled = false;
		for (const toolId of pending) {
			void registry
				.ensureToolModuleLoaded(toolId)
				.then(() => {
					if (cancelled) return;
					loadedModules = [...loadedModules, toolId];
				})
				.catch((error: unknown) => {
					console.error(
						`[pie-section-player] tool "${toolId}" failed to load its module for the "${surface}" surface`,
						error,
					);
				});
		}
		return () => {
			cancelled = true;
		};
	});

	/**
	 * Rebuilt per mount and per re-sync rather than captured: `sync` exists so a
	 * re-resolve reaches an element already on screen, and handing it the context
	 * from first mount would re-apply the values it already has.
	 */
	function surfaceContext(entry: GrantedSurfaceCapability): ToolSurfaceRenderContext {
		return {
			toolId: entry.toolId,
			featureId: entry.featureId,
			surface,
			parameters: entry.parameters,
			content: entry.content,
			services: {
				toolkitCoordinator: runtimeContext?.toolkitCoordinator ?? null,
				ttsService: runtimeContext?.ttsService ?? null,
				catalogResolver: runtimeContext?.catalogResolver ?? null,
			},
		};
	}

	const mounted = new Map<
		string,
		{
			element: HTMLElement;
			sync?: (context: ToolSurfaceRenderContext) => void;
			destroy?: () => void;
		}
	>();

	function unmountTool(toolId: string): void {
		const entry = mounted.get(toolId);
		if (!entry) return;
		mounted.delete(toolId);
		try {
			entry.destroy?.();
		} catch {
			// A capability that throws on teardown must not strand the element.
		}
		entry.element.remove();
		mountedCount = mounted.size;
	}

	// Imperative rather than an `{#each}` of components, because what renders is a
	// host-registered element this package must not import. Reconciled by toolId so
	// a re-resolve reapplies props through `sync` instead of tearing the element
	// down.
	$effect(() => {
		const target = anchor;
		const entries = granted;
		const registry = toolRegistry;
		const loaded = loadedModules;
		if (!target || !registry) {
			untrack(() => {
				for (const toolId of [...mounted.keys()]) unmountTool(toolId);
			});
			return;
		}

		untrack(() => {
			const mountable = entries.filter((entry) => loaded.includes(entry.toolId));
			const wanted = new Set(mountable.map((entry) => entry.toolId));
			for (const toolId of [...mounted.keys()]) {
				if (!wanted.has(toolId)) unmountTool(toolId);
			}

			for (const entry of mountable) {
				const existing = mounted.get(entry.toolId);
				if (existing) {
					try {
						existing.sync?.(surfaceContext(entry));
					} catch {
						// A failed reapply leaves the element as it was, which is better than
						// removing content the learner is reading.
					}
					continue;
				}
				let rendered: ReturnType<typeof registry.renderForSurface> = null;
				try {
					rendered = registry.renderForSurface(entry.toolId, surfaceContext(entry));
				} catch (error) {
					console.error(
						`[pie-section-player] tool "${entry.toolId}" failed to render into the "${surface}" surface`,
						error,
					);
					rendered = null;
				}
				if (!rendered?.element) continue;
				if (rendered.ariaLabel) {
					rendered.element.setAttribute("aria-label", rendered.ariaLabel);
				}
				target.appendChild(rendered.element);
				mounted.set(entry.toolId, {
					element: rendered.element,
					sync: rendered.sync,
					destroy: rendered.destroy,
				});
				mountedCount = mounted.size;
			}
		});
	});

	$effect(() => {
		return () => {
			for (const toolId of [...mounted.keys()]) unmountTool(toolId);
		};
	});

	/** In the DOM as soon as something is granted, so there is an anchor to mount into. */
	const stackMountable = $derived(granted.length > 0);
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
		data-occupied={mountedCount > 0 ? "" : undefined}
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
