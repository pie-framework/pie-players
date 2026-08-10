<svelte:options
	customElement={{
		tag: "pie-section-player-base",
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			// Presentation flag mirrored onto the toolkit runtime context.
			// Controls render <nds-icon-button> only when this is explicitly
			// true; otherwise they use plain <button>s. Two-tier:
			// `runtime.ndsIcons` wins over this top-level prop; defaults to
			// false (opt-in).
			ndsIcons: { attribute: "nds-icons", type: "Boolean" },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			toolConfigStrictness: {
				attribute: "tool-config-strictness",
				type: "String",
			},
			onFrameworkError: { type: "Object", reflect: false },
			// M6 canonical stage-change callback. Mirrors
			// `runtime.onStageChange`; resolver picks runtime over prop.
			// Wired imperatively to the toolkit element so the resolved
			// handler reaches the canonical stage emit point.
			onStageChange: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element";
	import {
		type FrameworkErrorModel,
		type ToolConfigStrictness,
		type ToolkitCoordinatorApi,
		type ToolRegistry,
		type ToolSurfaceRenderContext,
		type ToolSurfaceRenderResult,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		createPackagedToolRegistry,
		DEFAULT_TOOL_MODULE_LOADERS,
	} from "@pie-players/pie-default-tool-loaders";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, onDestroy, untrack } from "svelte";
	import { SectionController } from "../controllers/SectionController.js";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import { EMPTY_COMPOSITION } from "./shared/composition.js";
	import {
		DEFAULT_ASSESSMENT_ID,
		DEFAULT_ENV,
		DEFAULT_ISOLATION,
		resolveOnFrameworkError,
		type RuntimeConfig,
		type StageChangeHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/internal";
	let {
		assessmentId = DEFAULT_ASSESSMENT_ID,
		runtime = null as RuntimeConfig | null,
		ndsIcons = false,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		toolRegistry = null as ToolRegistry | null,
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
		onFrameworkError = undefined as
			| undefined
			| ((model: FrameworkErrorModel) => void),
		onStageChange = undefined as StageChangeHandler | undefined,
	} = $props();

	let toolkitElement = $state<any>(null);
	let activeToolkitCoordinator = $state<ToolkitCoordinatorApi | null>(null);
	let lastCompositionVersion = $state(-1);
	type BaseSectionPlayerEvents = {
		"composition-changed": { composition: SectionCompositionModel };
		"toolkit-ready": Record<string, unknown>;
		"section-ready": Record<string, unknown>;
		"framework-error": Record<string, unknown>;
		"session-changed": Record<string, unknown>;
		"runtime-owned": Record<string, unknown>;
		"runtime-inherited": Record<string, unknown>;
	};
	const dispatch = createEventDispatcher<BaseSectionPlayerEvents>();
	const effectiveAssessmentId = $derived.by(() => runtime?.assessmentId ?? assessmentId);
	const effectivePlayerType = $derived.by(() => runtime?.playerType);
	const effectivePlayer = $derived.by(() => runtime?.player ?? null);
	const effectiveLazyInit = $derived.by(() => runtime?.lazyInit);
	const effectiveTools = $derived.by(() => runtime?.tools ?? null);
	const effectiveToolContextResolvers = $derived.by(
		() => runtime?.toolContextResolvers ?? null,
	);
	const effectiveToolConfigStrictness = $derived.by(() => {
		const value = runtime?.toolConfigStrictness ?? toolConfigStrictness;
		return value === "off" || value === "warn" || value === "error"
			? value
			: "error";
	});
	const effectiveAccessibility = $derived.by(
		() => runtime?.accessibility ?? null,
	);
	const effectiveCoordinator = $derived.by(() => runtime?.coordinator ?? null);
	const effectiveCreateSectionController = $derived.by(
		() => runtime?.createSectionController,
	);
	const effectiveIsolation = $derived.by(
		() => runtime?.isolation ?? DEFAULT_ISOLATION,
	);
	const effectiveEnv = $derived.by(() => runtime?.env ?? DEFAULT_ENV);
	// Two-tier resolution: `runtime.ndsIcons` wins over the top-level prop.
	// Opt-in — NDS icon buttons render only when explicitly enabled.
	//
	// Resolve to `true` or `undefined` (never `false`): a Svelte custom
	// element serializes `nds-icons={false}` to the attribute string
	// `"false"`, and the toolkit's Boolean prop coerces *any present*
	// attribute — including `"false"` — to `true`. Passing `undefined`
	// removes the attribute so the toolkit falls back to its own `false`
	// default. See PieAssessmentToolkit `ndsIcons`.
	const effectiveNdsIcons = $derived.by(() =>
		(runtime?.ndsIcons ?? ndsIcons) === true ? true : undefined,
	);
	const defaultToolRegistry = createPackagedToolRegistry({
		toolModuleLoaders: DEFAULT_TOOL_MODULE_LOADERS,
	});
	const effectiveToolRegistry = $derived(toolRegistry ?? defaultToolRegistry);
	// Two-tier resolution. The base CE talks to the toolkit directly (no
	// kernel layer), so it owns the resolver boundary in this path.
	const effectiveOnFrameworkError = $derived.by(() =>
		resolveOnFrameworkError({
			runtime,
			onFrameworkError,
		}),
	);
	// Two-tier resolution for `onStageChange` (M6). Strict mirror rule
	// applies: `runtime.onStageChange` wins over the top-level prop.
	const effectiveOnStageChange = $derived.by(
		() => runtime?.onStageChange ?? onStageChange,
	);
	const effectiveSectionId = $derived.by(
		() => sectionId || (section as any)?.identifier || "",
	);

	function emit<K extends keyof BaseSectionPlayerEvents>(
		name: K,
		detail: BaseSectionPlayerEvents[K],
	): void {
		dispatch(name, detail);
	}

	function handleCompositionChanged(event: Event): void {
		const detail = (event as CustomEvent<{
			composition?: SectionCompositionModel;
			version?: number;
		}>).detail;
		const nextComposition = detail?.composition || EMPTY_COMPOSITION;
		const nextVersion =
			typeof detail?.version === "number"
				? detail.version
				: lastCompositionVersion + 1;
		if (nextVersion === lastCompositionVersion) return;
		lastCompositionVersion = nextVersion;
		emit("composition-changed", {
			composition: nextComposition,
		});
	}

	function handleToolkitEvent(
		event: Event,
		eventName: Exclude<keyof BaseSectionPlayerEvents, "composition-changed">,
	): void {
		const detail = (event as CustomEvent).detail as Record<string, unknown>;
		if (eventName === "toolkit-ready" && detail?.coordinator) {
			activeToolkitCoordinator =
				detail.coordinator as ToolkitCoordinatorApi;
		}
		emit(eventName, detail || ({} as Record<string, unknown>));
	}

	function handleToolkitReadyEvent(event: Event): void {
		handleToolkitEvent(event, "toolkit-ready");
	}

	function handleSectionReadyEvent(event: Event): void {
		handleToolkitEvent(event, "section-ready");
	}

	function handleFrameworkErrorEvent(event: Event): void {
		handleToolkitEvent(event, "framework-error");
	}

	function handleSessionChangedEvent(event: Event): void {
		handleToolkitEvent(event, "session-changed");
	}

	function handleRuntimeOwnedEvent(event: Event): void {
		handleToolkitEvent(event, "runtime-owned");
	}

	function handleRuntimeInheritedEvent(event: Event): void {
		handleToolkitEvent(event, "runtime-inherited");
	}

	// Section-scoped overlay capabilities go through the coordinator's
	// `ToolPolicyEngine`, which applies placement + `policy.allowed` /
	// `policy.blocked` + provider veto + PNP/profile gates in one pass,
	// so this CE does not duplicate those checks against the raw
	// `tools` config.
	//
	// The engine answer can change without the coordinator reference
	// changing (e.g. host calls `updateAssessment(...)` mid-session),
	// so we bump `policyVersion` from `onPolicyChange` to retrigger
	// this derivation.
	let policyVersion = $state(0);
	$effect(() => {
		const coord = activeToolkitCoordinator;
		if (!coord || typeof coord.onPolicyChange !== "function") return;
		const unsubscribe = coord.onPolicyChange(() => {
			policyVersion += 1;
		});
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// detach errors are non-fatal
			}
		};
	});
	// Keep the scope shape aligned with what `pie-item-toolbar`
	// passes for its own per-item decisions so a custom
	// `PolicySource` that reads e.g. `assessmentId` cannot disagree
	// with the toolbar's verdict for the same level / id. Item +
	// passage scopes here only know the section we're mounting in
	// (item / passage ids belong to the inner toolbars), so we pass
	// the section id as the scope id and let `assessmentId` /
	// `sectionId` carry the rest.
	//
	// `Array.some` short-circuits on the first matching level, so a
	// capability registered at one level costs one engine call; the
	// worst case is three.
	const OVERLAY_LEVELS = ["section", "item", "passage"] as const;

	/**
	 * The section-scoped surface this CE offers. Capabilities opt in by listing it
	 * in their registration's `surfaces`, so nothing here names one — the
	 * annotation toolbar used to be named in three places in this file, which is
	 * why a host could not contribute a second section-scoped capability without
	 * a PR against this repo.
	 */
	const SECTION_OVERLAY_SURFACE = "section-overlay";

	const overlayCapabilities = $derived(
		effectiveToolRegistry?.getToolsBySurface?.(SECTION_OVERLAY_SURFACE) ?? [],
	);

	type GrantedOverlayCapability = {
		tool: (typeof overlayCapabilities)[number];
		featureId: string;
		parameters?: unknown;
	};

	/**
	 * Which registered capabilities this surface may mount, and under which of the
	 * two policy questions.
	 *
	 * A placement-driven capability (`toolbar-toggle`, `selection-gateway`) is
	 * granted through a placement-scoped tool decision, because that is where its
	 * candidacy comes from. A `region` capability has no toolbar presence, so it
	 * never appears in a placement list and `decideToolPolicy` would answer "absent"
	 * for the wrong reason — and placing it to compensate is a hard
	 * `tools.unplaceableActivation` error. Asking the feature question for those is
	 * what makes this surface reachable by a capability that is only ever a region,
	 * matching how the item card gates its own surface.
	 */
	const grantedOverlayTools = $derived.by((): GrantedOverlayCapability[] => {
		void policyVersion;
		const coord = activeToolkitCoordinator;
		if (!coord) return [];
		const scopeId = effectiveSectionId || "*";
		const decisionForLevel = (level: (typeof OVERLAY_LEVELS)[number]) =>
			coord.decideToolPolicy({
				level,
				scope: {
					level,
					scopeId,
					assessmentId: effectiveAssessmentId,
					sectionId: effectiveSectionId || undefined,
				},
			});
		return overlayCapabilities.flatMap(
			(tool): GrantedOverlayCapability[] => {
				// A capability declares which support ids grant it; any one is enough.
				const supportIds = tool.pnpSupportIds?.length
					? tool.pnpSupportIds
					: [tool.toolId];

				if (tool.activation === "region") {
					if (typeof coord.decideFeaturePolicy !== "function") return [];
					for (const supportId of supportIds) {
						const decision = coord.decideFeaturePolicy(supportId);
						if (decision?.granted !== true) continue;
						if (tool.requiresAuthoredContent) {
							// A content dependency resolves against a catalog owner scope,
							// and this surface is section-scoped: `CatalogOwnerContext` names
							// an item model or a passage, never a section. Mounting anyway
							// would hand the capability `content: undefined`, which is the
							// dead-affordance the declaration exists to prevent.
							console.warn(
								`[pie-section-player] tool "${tool.toolId}" declares a content dependency, which the section-scoped "${SECTION_OVERLAY_SURFACE}" surface cannot resolve. Register it on a per-item surface instead.`,
							);
							return [];
						}
						return [
							{ tool, featureId: supportId, parameters: decision.parameters },
						];
					}
					return [];
				}

				if (typeof coord.decideToolPolicy !== "function") return [];
				for (const level of OVERLAY_LEVELS) {
					const entry = decisionForLevel(level).visibleTools.find(
						(candidate) => candidate.toolId === tool.toolId,
					);
					if (entry) {
						return [
							{
								tool,
								// The grant came through a placement-scoped tool decision, so
								// the feature id is the capability's own first support id.
								featureId: supportIds[0],
								parameters: entry.settings,
							},
						];
					}
				}
				return [];
			},
		);
	});

	// Tool ids whose custom-element module is present. A capability stays unmounted
	// until its module resolves, so an optional package that is not installed
	// leaves the surface empty rather than mounting an undefined element.
	let loadedOverlayModules = $state<string[]>([]);

	$effect(() => {
		const registry = effectiveToolRegistry;
		if (!registry) return;
		const pending = grantedOverlayTools
			.map(({ tool }) => tool.toolId)
			.filter((toolId) => !loadedOverlayModules.includes(toolId));
		if (pending.length === 0) return;
		let cancelled = false;
		for (const toolId of pending) {
			void registry
				.ensureToolModuleLoaded(toolId)
				.then(() => {
					if (cancelled) return;
					if (!loadedOverlayModules.includes(toolId)) {
						loadedOverlayModules = [...loadedOverlayModules, toolId];
					}
				})
				.catch(() => {
					// Keep the capability unmounted if its optional module is absent.
				});
		}
		return () => {
			cancelled = true;
		};
	});

	let overlayAnchor = $state<HTMLDivElement | null>(null);
	/**
	 * Mounted surface instances by tool id. Deliberately not `$state`: the mount
	 * effect writes it on every run, and a reactive map would re-invalidate the
	 * effect that just wrote it.
	 */
	const mountedOverlays = new Map<
		string,
		{
			element: HTMLElement;
			sync?: (context: ToolSurfaceRenderContext) => void;
			destroy?: () => void;
		}
	>();

	/**
	 * What the host tells the capability, rebuilt per mount and per re-sync so a
	 * coordinator swap mid-session reaches an already-mounted element. These were
	 * reactive props before the surface mechanism, and a closure over the
	 * render-time services would leave the capability wired to the previous
	 * session's coordinator.
	 */
	function overlaySurfaceContext(
		granted: GrantedOverlayCapability,
		coord: NonNullable<typeof activeToolkitCoordinator>,
	): ToolSurfaceRenderContext {
		return {
			toolId: granted.tool.toolId,
			featureId: granted.featureId,
			surface: SECTION_OVERLAY_SURFACE,
			parameters: granted.parameters,
			services: {
				toolkitCoordinator: coord,
				ttsService: coord.ttsService ?? null,
				catalogResolver: coord.catalogResolver ?? null,
			},
		};
	}

	function unmountOverlay(toolId: string): void {
		const mounted = mountedOverlays.get(toolId);
		if (!mounted) return;
		mountedOverlays.delete(toolId);
		try {
			mounted.destroy?.();
		} catch {
			// A capability failing to tear down must not strand the others.
		}
		mounted.element.remove();
	}

	$effect(() => {
		const anchor = overlayAnchor;
		const coord = activeToolkitCoordinator;
		const registry = effectiveToolRegistry;
		const granted = grantedOverlayTools;
		const loaded = loadedOverlayModules;
		if (!anchor || !coord || !registry) {
			untrack(() => {
				for (const toolId of [...mountedOverlays.keys()]) unmountOverlay(toolId);
			});
			return;
		}

		// Wiring only, per the Svelte subscription guidance: everything below reads
		// and writes non-reactive state, and tracking it would re-invalidate this
		// effect on its own writes.
		untrack(() => {
			const mountable = granted.filter(({ tool }) =>
				loaded.includes(tool.toolId),
			);
			const wanted = new Set(mountable.map(({ tool }) => tool.toolId));
			for (const toolId of [...mountedOverlays.keys()]) {
				if (!wanted.has(toolId)) unmountOverlay(toolId);
			}

			for (const granted of mountable) {
				const tool = granted.tool;
				const mounted = mountedOverlays.get(tool.toolId);
				if (mounted) {
					// Already mounted: let the capability reapply props rather than
					// remounting, which would drop its own state and, for a selection
					// gateway, the learner's current selection.
					try {
						mounted.sync?.(overlaySurfaceContext(granted, coord));
					} catch {
						// A failed re-sync must not break the other capabilities.
					}
					continue;
				}
				let rendered: ToolSurfaceRenderResult | null | undefined;
				try {
					// Through the registry, not `tool.renderSurface` directly: the
					// registry owns the component-override map a capability resolves its
					// element tag against.
					rendered = registry.renderForSurface(
						tool.toolId,
						overlaySurfaceContext(granted, coord),
					);
				} catch (error) {
					console.error(
						`[pie-section-player] tool "${tool.toolId}" failed to render into the "${SECTION_OVERLAY_SURFACE}" surface`,
						error,
					);
					continue;
				}
				// `null` means "nothing to show", which is a legitimate answer from a
				// capability and not an error.
				if (!rendered?.element) continue;
				if (rendered.ariaLabel) {
					rendered.element.setAttribute("aria-label", rendered.ariaLabel);
				}
				anchor.appendChild(rendered.element);
				mountedOverlays.set(tool.toolId, {
					element: rendered.element,
					sync: rendered.sync,
					destroy: rendered.destroy,
				});
			}
		});
	});

	onDestroy(() => {
		for (const toolId of [...mountedOverlays.keys()]) unmountOverlay(toolId);
	});

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.createSectionController =
			effectiveCreateSectionController || (() => new SectionController());
	});

	// Svelte 5 compiles `<custom-element onCamelCase={fn}>` as
	// `addEventListener('camelcase', fn)` rather than a property
	// assignment, so the canonical model-shape `onFrameworkError`
	// callback prop on the toolkit cannot be wired through template
	// binding. Imperatively assign it here so the base CE's resolved
	// callback (runtime > prop) reaches the toolkit's bus subscriber.
	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.onFrameworkError = effectiveOnFrameworkError;
		return () => {
			toolkitElement.onFrameworkError = undefined;
		};
	});

	// Same Svelte-5 rationale for the M6 `onStageChange` callback. The
	// toolkit's stage tracker invokes the resolved handler at the same
	// emit point as the `pie-stage-change` DOM event so the callback
	// and the event stay in lockstep for hosts using either surface.
	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.onStageChange = effectiveOnStageChange;
		return () => {
			toolkitElement.onStageChange = undefined;
		};
	});

	type BaseNavigationState = {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		currentItemId?: string;
	};

	export function navigateToItem(index: number): unknown {
		if (!toolkitElement?.navigateToItem) return null;
		return toolkitElement.navigateToItem(index);
	}

	export function getCompositionModelSnapshot(): unknown {
		if (!toolkitElement?.getCompositionModel) return null;
		return toolkitElement.getCompositionModel();
	}

	export function getNavigationStateSnapshot(): BaseNavigationState {
		const compositionModel = getCompositionModelSnapshot() as
			| {
					currentItemIndex?: number;
					items?: Array<{ id?: string }>;
			  }
			| null;
		const items = compositionModel?.items || [];
		const currentIndex = Math.max(
			0,
			Math.min(
				typeof compositionModel?.currentItemIndex === "number"
					? compositionModel.currentItemIndex
					: 0,
				Math.max(0, items.length - 1),
			),
		);
		return {
			currentIndex,
			totalItems: items.length,
			canNext: currentIndex < items.length - 1,
			canPrevious: currentIndex > 0,
			currentItemId: items[currentIndex]?.id || undefined,
		};
	}

	function resolveSectionController(): SectionControllerHandle | null {
		const targetSectionId = effectiveSectionId;
		if (!targetSectionId) return null;
		const resolvedAttemptId = attemptId || undefined;
		const coordinator =
			activeToolkitCoordinator ||
			(effectiveCoordinator as {
				getSectionController?: (args: {
					sectionId: string;
					attemptId?: string;
				}) => SectionControllerHandle | undefined;
			} | null);
		if (!coordinator?.getSectionController) return null;
		return (
			coordinator.getSectionController({
				sectionId: targetSectionId,
				attemptId: resolvedAttemptId,
			}) || null
		);
	}

	export function getSectionController(): SectionControllerHandle | null {
		return resolveSectionController();
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	): Promise<SectionControllerHandle | null> {
		const start = Date.now();
		while (Date.now() - start < timeoutMs) {
			const controller = resolveSectionController();
			if (controller) return controller;
			await new Promise((resolve) => setTimeout(resolve, 25));
		}
		return null;
	}

</script>

<pie-assessment-toolkit
	bind:this={toolkitElement}
	assessment-id={effectiveAssessmentId}
	section={section}
	section-id={sectionId}
	attempt-id={attemptId}
	player-type={effectivePlayerType}
	player={effectivePlayer}
	env={effectiveEnv}
	nds-icons={effectiveNdsIcons}
	lazy-init={effectiveLazyInit}
	tool-config-strictness={effectiveToolConfigStrictness}
	tools={effectiveTools}
	toolContextResolvers={effectiveToolContextResolvers}
	toolRegistry={effectiveToolRegistry}
	accessibility={effectiveAccessibility}
	coordinator={effectiveCoordinator}
	isolation={effectiveIsolation}
	oncomposition-changed={handleCompositionChanged}
	ontoolkit-ready={handleToolkitReadyEvent}
	onsection-ready={handleSectionReadyEvent}
	onframework-error={handleFrameworkErrorEvent}
	onsession-changed={handleSessionChangedEvent}
	onruntime-owned={handleRuntimeOwnedEvent}
	onruntime-inherited={handleRuntimeInheritedEvent}
>
	<!-- Mount point for section-scoped surface capabilities. Always present so a
	     capability granted mid-session has somewhere to land, and inside
	     <pie-assessment-toolkit> so the toolkit's context requests still bubble to
	     it from a mounted element. -->
	<div
		bind:this={overlayAnchor}
		class="pie-section-player-surface-anchor"
		data-pie-tool-surface={SECTION_OVERLAY_SURFACE}
	></div>
	<slot></slot>
</pie-assessment-toolkit>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	/* Layout-transparent: the anchor is always present, and a permanent flex item
	   would shift `gap` and child-index selectors in the column below it whether or
	   not any capability is mounted. */
	.pie-section-player-surface-anchor {
		display: contents;
	}

	pie-assessment-toolkit {
		display: flex;
		flex-direction: column;
		flex: 1;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
</style>
