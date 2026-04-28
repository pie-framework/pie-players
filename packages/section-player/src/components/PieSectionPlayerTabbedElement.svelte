<svelte:options
	customElement={{
		tag: "pie-section-player-tabbed",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			section: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			player: { type: "Object", reflect: false },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			env: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			debug: { attribute: "debug", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
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

	const DEFAULT_NARROW_BREAKPOINT_PX = 1100;
	const NARROW_BREAKPOINT_MIN_PX = 400;
	const NARROW_BREAKPOINT_MAX_PX = 2000;
	const CONTENT_MAX_WIDTH_MIN_PX = 320;
	const CONTENT_MAX_WIDTH_MAX_PX = 2200;

	function resolveConfiguredPx(
		value: unknown,
		min: number,
		max: number,
	): number | undefined {
		if (value === undefined || value === null || value === "") return undefined;
		const num = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(num)) return undefined;
		return Math.max(min, Math.min(max, num));
	}

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		playerType,
		player,
		lazyInit,
		tools,
		accessibility,
		coordinator,
		env,
		iifeBundleHost,
		debug = undefined as string | boolean | undefined,
		showToolbar = "false" as boolean | string | null | undefined,
		toolbarPosition = "right",
		enabledTools = "",
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
		splitPaneCollapseStrategy: _splitPaneCollapseStrategy = "vertical" as
			| "vertical"
			| "tabbed"
			| string,
	} = $props();
	const dispatch = createEventDispatcher();
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let isNarrow = $state(false);
	const paneIdBase = $derived.by(() =>
		`pie-section-player-tabbed-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			player,
			component: "pie-section-player-tabbed",
		}),
	);
	// Two-tier resolution for `onFrameworkError` is handled by the
	// kernel's resolver (`resolveSectionPlayerRuntimeState` →
	// `effectiveRuntime.onFrameworkError`); the CE forwards the
	// top-level prop and `runtime` verbatim and the resolver picks
	// `runtime.onFrameworkError` over `onFrameworkError`.

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const hostElement = $derived.by(() => getHostElement());

	const clampedBreakpoint = $derived.by(() => {
		const n = narrowLayoutBreakpoint ?? DEFAULT_NARROW_BREAKPOINT_PX;
		const num = typeof n === "number" ? n : Number(n);
		const value = Number.isFinite(num) ? num : DEFAULT_NARROW_BREAKPOINT_PX;
		return Math.max(
			NARROW_BREAKPOINT_MIN_PX,
			Math.min(NARROW_BREAKPOINT_MAX_PX, value),
		);
	});

	$effect(() => {
		const bp = clampedBreakpoint;
		if (typeof window === "undefined") return;
		const query: MediaQueryList = window.matchMedia(`(max-width: ${bp}px)`);
		function update() {
			isNarrow = query.matches;
		}
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	const effectiveToolbarPosition = $derived(isNarrow ? "top" : toolbarPosition);
	const configuredContentMaxWidthNoPassagePx = $derived.by(() =>
		resolveConfiguredPx(
			contentMaxWidthNoPassage,
			CONTENT_MAX_WIDTH_MIN_PX,
			CONTENT_MAX_WIDTH_MAX_PX,
		)
	);
	const configuredContentMaxWidthWithPassagePx = $derived.by(() => {
		const withPassage = resolveConfiguredPx(
			contentMaxWidthWithPassage,
			CONTENT_MAX_WIDTH_MIN_PX,
			CONTENT_MAX_WIDTH_MAX_PX,
		);
		if (withPassage === undefined) return undefined;
		if (configuredContentMaxWidthNoPassagePx === undefined) return withPassage;
		return Math.max(configuredContentMaxWidthNoPassagePx, withPassage);
	});

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

	export function focusStart(): boolean {
		return kernelRef?.focusStart?.() === true;
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
	{runtime}
	{section}
	{sectionId}
	{attemptId}
	{playerType}
	{player}
	{lazyInit}
	{tools}
	{accessibility}
	{coordinator}
	{env}
	{iifeBundleHost}
	{debug}
	{showToolbar}
	toolbarPosition={effectiveToolbarPosition}
	{enabledTools}
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
