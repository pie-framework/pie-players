<svelte:options
	customElement={{
		tag: "pie-section-player-tabbed",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			// Presentation flag: opt in to NDS icon buttons. Convenience
			// attribute mirrored onto `runtime.ndsIcons` (runtime wins if both
			// are set). Defaults to unset (plain <button>s).
			ndsIcons: { attribute: "nds-icons", type: "Boolean" },
			// Interface locale: the language the player renders its own UI in, as a
			// BCP-47 tag. Convenience attribute mirrored onto `runtime.locale`
			// (runtime wins if both are set). Unset renders `en-US`. Distinct
			// from the authored content language, which travels on `env`.
			locale: { attribute: "locale", type: "String" },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			debug: { attribute: "debug", type: "String" },
			// Composition context: the level this player's card headings occupy.
			// Descendants derive their own outline from it — see
			// docs/architecture/composition-context.md.
			baseHeadingLevel: { attribute: "base-heading-level", type: "Number" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			sectionHostButtons: { type: "Object", reflect: false },
			itemHostButtons: { type: "Object", reflect: false },
			passageHostButtons: { type: "Object", reflect: false },
			policies: { type: "Object", reflect: false },
			hooks: { type: "Object", reflect: false },
			toolConfigStrictness: {
				attribute: "tool-config-strictness",
				type: "String",
			},
			onFrameworkError: { type: "Object", reflect: false },
			// M6 canonical stage-change callback. Mirrors
			// `runtime.onStageChange`; resolver picks runtime over prop.
			onStageChange: { type: "Object", reflect: false },
			// M6 canonical loading-complete callback. Mirrors
			// `runtime.onLoadingComplete`; the kernel invokes it at the
			// same emit point as `pie-loading-complete` so callback and
			// event stay in lockstep per cohort.
			onLoadingComplete: { type: "Object", reflect: false },
			narrowLayoutBreakpoint: { attribute: "narrow-layout-breakpoint", type: "Number" },
			contentMaxWidthNoPassage: {
				attribute: "content-max-width-no-passage",
				type: "Number",
			},
			contentMaxWidthWithPassage: {
				attribute: "content-max-width-with-passage",
				type: "Number",
			},
			splitPaneMinRegionWidth: {
				attribute: "split-pane-min-region-width",
				type: "Number",
			},
			splitPaneInitialPassageWidth: {
				attribute: "split-pane-initial-passage-width",
				type: "Number",
			},
			splitPaneCollapseStrategy: {
				attribute: "split-pane-collapse-strategy",
				type: "String",
			},
		},
	}}
/>

<script lang="ts">
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		SECTION_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import "./section-player-item-card-element.js";
	import "./section-player-passage-card-element.js";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import { mergeLayoutAttrsIntoRuntime } from "./shared/section-player-host-runtime.js";
	import SectionPlayerTabbedContent from "./shared/SectionPlayerTabbedContent.svelte";
	import { createEventDispatcher } from "svelte";
	import type {
		FrameworkErrorModel,
		ToolConfigStrictness,
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import type {
		RuntimeConfig,
		StageChangeHandler,
		LoadingCompleteHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/internal";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerPolicies } from "../policies/types.js";
	import { isTelemetryEnabled } from "../policies/index.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";
	import {
		clampNarrowBreakpoint,
		createNarrowLayoutWatch,
		getShellHostElement,
		resolveConfiguredPx,
		resolveContentMaxWidths,
	} from "./shared/section-player-shell-layout.svelte.js";


	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		ndsIcons = undefined as boolean | undefined,
		locale = "",
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		iifeBundleHost,
		debug = undefined as string | boolean | undefined,
		baseHeadingLevel = undefined as number | undefined,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		policies = undefined as SectionPlayerPolicies | undefined,
		hooks = undefined as SectionPlayerHostHooks | undefined,
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
		onFrameworkError = undefined as
			| undefined
			| ((model: FrameworkErrorModel) => void),
		onStageChange = undefined as StageChangeHandler | undefined,
		onLoadingComplete = undefined as LoadingCompleteHandler | undefined,
		narrowLayoutBreakpoint = undefined as number | undefined,
		contentMaxWidthNoPassage = undefined as number | undefined,
		contentMaxWidthWithPassage = undefined as number | undefined,
		splitPaneMinRegionWidth: _splitPaneMinRegionWidth = undefined as
			| number
			| undefined,
		splitPaneInitialPassageWidth: _splitPaneInitialPassageWidth = undefined as
			| number
			| string
			| undefined,
		splitPaneCollapseStrategy: _splitPaneCollapseStrategy = "vertical" as
			| "vertical"
			| "tabbed"
			| string,
	} = $props();
	// Fold the `nds-icons` convenience attribute into the runtime handed to
	// the kernel (host `runtime.ndsIcons` still wins if both are set).
	const kernelRuntime = $derived(
		mergeLayoutAttrsIntoRuntime(runtime, { ndsIcons, locale }),
	);
	const dispatch = createEventDispatcher();
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	const paneIdBase = $derived.by(() =>
		`pie-section-player-tabbed-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			component: "pie-section-player-tabbed",
		}),
	);
	// Two-tier resolution for `onFrameworkError` is handled by the
	// kernel's resolver (`resolveSectionPlayerRuntimeState` →
	// `effectiveRuntime.onFrameworkError`); the CE forwards the
	// top-level prop and `runtime` verbatim and the resolver picks
	// `runtime.onFrameworkError` over `onFrameworkError`.

	const hostElement = $derived.by(() => getShellHostElement(anchor));

	const clampedBreakpoint = $derived(
		clampNarrowBreakpoint(narrowLayoutBreakpoint),
	);
	const narrowLayout = createNarrowLayoutWatch(() => clampedBreakpoint);


	const effectiveToolbarPosition = $derived(narrowLayout.isNarrow ? "top" : toolbarPosition);
	const contentMaxWidths = $derived(
		resolveContentMaxWidths(contentMaxWidthNoPassage, contentMaxWidthWithPassage),
	);
	const configuredContentMaxWidthNoPassagePx = $derived(
		contentMaxWidths.noPassagePx,
	);
	const configuredContentMaxWidthWithPassagePx = $derived(
		contentMaxWidths.withPassagePx,
	);

	function forward(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	export function getSnapshot(): SectionPlayerSnapshot | null {
		return kernelRef?.getSnapshot?.() ?? null;
	}

	export function selectComposition(): SectionPlayerSnapshot["composition"] | null {
		return kernelRef?.selectComposition?.() ?? null;
	}

	export function selectNavigation(): SectionPlayerSnapshot["navigation"] | null {
		return kernelRef?.selectNavigation?.() ?? null;
	}

	export function selectReadiness(): SectionPlayerSnapshot["readiness"] | null {
		return kernelRef?.selectReadiness?.() ?? null;
	}

	export function navigateTo(index: number): boolean {
		return kernelRef?.navigateTo?.(index) === true;
	}

	export function navigateNext(): boolean {
		return kernelRef?.navigateNext?.() === true;
	}

	export function navigatePrevious(): boolean {
		return kernelRef?.navigatePrevious?.() === true;
	}

	export function getSectionController() {
		return kernelRef?.getSectionController?.() || null;
	}

	export async function waitForSectionController(
		timeoutMs = 5000,
	) {
		const controller = await kernelRef?.waitForSectionController?.(timeoutMs);
		return controller || null;
	}

	$effect(() => {
		if (!hostElement) return;
		// `policies.telemetry.enabled === false` skips instrumentation bridge
		// setup entirely so hosts that opt out emit no `pie-section-*`
		// telemetry events through the bridge.
		if (!isTelemetryEnabled(policies)) return;
		const localHost = hostElement;
		return attachInstrumentationEventBridge({
			host: localHost,
			instrumentationProvider,
			component: "pie-section-player-tabbed",
			eventMap: SECTION_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "section",
				assessmentId,
				sectionId,
				attemptId: attemptId || undefined,
			},
			shouldTrackEvent: (event: Event) => event.target === localHost,
			dedupeWindowMs: 100,
		});
	});
</script>

<div bind:this={anchor} class="pie-section-player-observability-anchor" aria-hidden="true"></div>
<SectionPlayerLayoutKernel
	bind:this={kernelRef}
	{assessmentId}
	runtime={kernelRuntime}
	{section}
	{sectionId}
	{attemptId}
	{iifeBundleHost}
	{debug}
	{baseHeadingLevel}
	{showToolbar}
	toolbarPosition={effectiveToolbarPosition}
	{toolRegistry}
	{sectionHostButtons}
	{itemHostButtons}
	{passageHostButtons}
	{policies}
	{hooks}
	{toolConfigStrictness}
	{onFrameworkError}
	{onStageChange}
	{onLoadingComplete}
	sourceCe="pie-section-player-tabbed"
	host={hostElement}
	playerActionConfig={{
		stateKey: "__tabbedAppliedParams",
		includeSessionRefInState: false,
	}}
	on:runtime-owned={forward}
	on:runtime-inherited={forward}
	on:session-changed={forward}
	on:composition-changed={forward}
	on:element-preload-retry={forward}
	on:element-preload-error={forward}
	let:layoutModel
>
	<SectionPlayerTabbedContent
		{layoutModel}
		itemToolbarTools={layoutModel.itemToolbarTools}
		passageToolbarTools={layoutModel.passageToolbarTools}
		contentMaxWidthNoPassagePx={configuredContentMaxWidthNoPassagePx}
		contentMaxWidthWithPassagePx={configuredContentMaxWidthWithPassagePx}
		toolRegistry={layoutModel.toolRegistry}
		itemHostButtons={layoutModel.itemHostButtons}
		passageHostButtons={layoutModel.passageHostButtons}
		{iifeBundleHost}
		preloadComponentTag="pie-section-player-tabbed"
		idBase={paneIdBase}
	/>
</SectionPlayerLayoutKernel>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		max-height: 100%;
		overflow: hidden;
	}

	.pie-section-player-observability-anchor {
		display: none;
	}
</style>
