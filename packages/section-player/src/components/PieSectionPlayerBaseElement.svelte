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
			// Interface locale: the language the player renders its own UI in, as a
			// BCP-47 tag. Convenience attribute mirrored onto `runtime.locale`
			// (runtime wins if both are set). Unset renders `en-US`. Distinct
			// from the authored content language, which travels on `env`.
			locale: { attribute: "locale", type: "String" },
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
	} from "@pie-players/pie-assessment-toolkit";
	import {
		createPackagedToolRegistry,
		DEFAULT_TOOL_MODULE_LOADERS,
	} from "@pie-players/pie-default-tool-loaders";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import {
		type AssessmentToolkitRuntimeContext,
		connectToolRuntimeContext,
	} from "@pie-players/pie-assessment-toolkit";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	import { createEventDispatcher, onDestroy } from "svelte";
	import { SectionController } from "../controllers/SectionController.js";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import { EMPTY_COMPOSITION } from "./shared/composition.js";
	import { createToolSurfaceHost } from "./shared/tool-surface-host.js";
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
		locale = "",
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
	// Two-tier resolution: `runtime.locale` wins over the top-level prop.
	//
	// Resolves to a tag or `undefined`, never `""`. A Svelte custom element
	// serializes an unset string prop to an empty attribute, and forwarding that
	// would have the toolkit resolve the empty locale rather than fall back to
	// its `en-US` default.
	const effectiveLocale = $derived.by(
		() => runtime?.locale || locale || undefined,
	);
	// Interface locale for the section-overlay surfaces this element mounts.
	//
	// Resolved from the toolkit's runtime context rather than from a second
	// provider: `overlayAnchor` sits inside `<pie-assessment-toolkit>` precisely so
	// context requests from a mounted element bubble to it, and the same is true of
	// a request made on the anchor itself. One provider serves the page.
	let surfaceRuntimeContext = $state<AssessmentToolkitRuntimeContext | null>(
		null,
	);
	// Unconditional: the facade wraps the English-only default before the anchor's
	// context request resolves, so a surface never sees an absent provider.
	const interfaceI18nForSurfaces = $derived(
		resolveInterfaceI18n(surfaceRuntimeContext),
	);
	$effect(() => {
		const anchor = overlayAnchor;
		if (!anchor) return;
		return connectToolRuntimeContext(anchor, (value) => {
			surfaceRuntimeContext = value;
		});
	});
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

	/**
	 * The section-scoped surface this CE offers. Capabilities opt in by listing it
	 * in their registration's `surfaces`, so nothing here names one — the
	 * annotation toolbar used to be named in three places in this file, which is
	 * why a host could not contribute a second section-scoped capability without
	 * a PR against this repo.
	 */
	const SECTION_OVERLAY_SURFACE = "section-overlay";
	let overlayAnchor = $state<HTMLDivElement | null>(null);
	const overlaySurfaceHost = createToolSurfaceHost(() => undefined);

	$effect(() => {
		const coordinator = activeToolkitCoordinator;
		// Reading the provider here is what re-mounts the surfaces when the locale
		// moves or a catalog lands: the toolkit republishes its context, the
		// derived provider changes identity, and a region label resolved before the
		// catalog arrived is not the one the learner keeps.
		void interfaceI18nForSurfaces;
		overlaySurfaceHost.update({
			anchor: overlayAnchor,
			surface: SECTION_OVERLAY_SURFACE,
			registry: effectiveToolRegistry,
			services: {
				toolkitCoordinator: coordinator,
				ttsService: coordinator?.ttsService ?? null,
				catalogResolver: coordinator?.catalogResolver ?? null,
				i18n: interfaceI18nForSurfaces,
			},
			scope: {
				kind: "section",
				assessmentId: effectiveAssessmentId,
				sectionId: effectiveSectionId,
			},
		});
	});

	onDestroy(() => overlaySurfaceHost.destroy());

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
	locale={effectiveLocale}
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
