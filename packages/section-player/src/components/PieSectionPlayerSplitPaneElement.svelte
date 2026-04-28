<svelte:options
	customElement={{
		tag: "pie-section-player-splitpane",
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
	import SectionPlayerVerticalContent from "./shared/SectionPlayerVerticalContent.svelte";
	// TS language service false-positive in this workspace: Svelte component has a default export.
	// @ts-ignore false-positive no-default-export in IDE language service for this import
	import SectionSplitDivider from "./shared/SectionSplitDivider.svelte";
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
	const SPLIT_PANE_MIN_REGION_MIN_PX = 160;
	const SPLIT_PANE_MIN_REGION_MAX_PX = 1200;
	const SPLIT_DIVIDER_TRACK_REM = 0.5;
	const SPLIT_LEFT_PERCENT_MIN = 20;
	const SPLIT_LEFT_PERCENT_MAX = 80;

	type SplitBounds = {
		min: number;
		max: number;
	};

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

	function clampSplitWidth(next: number, bounds: SplitBounds): number {
		return Math.max(bounds.min, Math.min(bounds.max, next));
	}

	function getDividerTrackPx(container: HTMLElement): number {
		const fontSizePx = Number.parseFloat(getComputedStyle(container).fontSize || "16");
		const safeFontSizePx = Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : 16;
		return safeFontSizePx * SPLIT_DIVIDER_TRACK_REM;
	}

	function computeSplitBounds(
		container: HTMLElement,
		minRegionWidthPx: number,
	): SplitBounds {
		const containerWidthPx = container.clientWidth;
		if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
			return { min: SPLIT_LEFT_PERCENT_MIN, max: SPLIT_LEFT_PERCENT_MAX };
		}
		const dividerTrackPx = getDividerTrackPx(container);
		const usableWidthPx = Math.max(0, containerWidthPx - dividerTrackPx);
		if (usableWidthPx <= 0) {
			return { min: 50, max: 50 };
		}
		const rawMinPercent = (minRegionWidthPx / usableWidthPx) * 100;
		if (!Number.isFinite(rawMinPercent) || rawMinPercent >= 50) {
			return { min: 50, max: 50 };
		}
		const min = Math.max(SPLIT_LEFT_PERCENT_MIN, rawMinPercent);
		const max = Math.min(SPLIT_LEFT_PERCENT_MAX, Math.max(min, 100 - min));
		return { min, max };
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
		splitPaneMinRegionWidth = undefined as number | undefined,
		splitPaneCollapseStrategy = "tabbed" as "vertical" | "tabbed" | string,
	} = $props();

	const clampedBreakpoint = $derived.by(() => {
		const n = narrowLayoutBreakpoint ?? DEFAULT_NARROW_BREAKPOINT_PX;
		const num = typeof n === "number" ? n : Number(n);
		const value = Number.isFinite(num) ? num : DEFAULT_NARROW_BREAKPOINT_PX;
		return Math.max(
			NARROW_BREAKPOINT_MIN_PX,
			Math.min(NARROW_BREAKPOINT_MAX_PX, value),
		);
	});

	let leftPanelWidth = $state(50);
	let splitBounds = $state<SplitBounds>({ min: 20, max: 80 });
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let isStacked = $state(false);
	const dispatch = createEventDispatcher();
	const paneIdBase = $derived.by(() =>
		`pie-section-player-splitpane-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const passagesPaneId = $derived(`${paneIdBase}-passages`);
	const itemsPaneId = $derived(`${paneIdBase}-items`);
	const splitDividerValueText = $derived(`${Math.round(leftPanelWidth)}% passages width`);
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
	const configuredSplitPaneMinRegionWidthPx = $derived.by(() =>
		resolveConfiguredPx(
			splitPaneMinRegionWidth,
			SPLIT_PANE_MIN_REGION_MIN_PX,
			SPLIT_PANE_MIN_REGION_MAX_PX,
		)
	);
	const normalizedCollapseStrategy = $derived.by(() =>
		splitPaneCollapseStrategy === "tabbed" ? "tabbed" : "vertical"
	);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			player,
			component: "pie-section-player-splitpane",
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

	$effect(() => {
		const bp = clampedBreakpoint;
		if (typeof window === "undefined") return;
		const query: MediaQueryList = window.matchMedia(`(max-width: ${bp}px)`);
		function update() {
			isStacked = query.matches;
		}
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	$effect(() => {
		const container = splitContainerElement;
		const minRegionWidthPx = configuredSplitPaneMinRegionWidthPx;
		if (typeof window === "undefined" || !container || typeof ResizeObserver === "undefined") {
			return;
		}
		if (minRegionWidthPx === undefined) {
			const defaultBounds = {
				min: SPLIT_LEFT_PERCENT_MIN,
				max: SPLIT_LEFT_PERCENT_MAX,
			} satisfies SplitBounds;
			splitBounds = defaultBounds;
			leftPanelWidth = clampSplitWidth(leftPanelWidth, defaultBounds);
			return;
		}
		const updateBounds = () => {
			const nextBounds = computeSplitBounds(container, minRegionWidthPx);
			splitBounds = nextBounds;
			leftPanelWidth = clampSplitWidth(leftPanelWidth, nextBounds);
		};
		updateBounds();
		const resizeObserver = new ResizeObserver(() => updateBounds());
		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	});

	function forward(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	function handleSplitResizePreview(event: Event) {
		if (!splitContainerElement) return;
		const detail = (event as CustomEvent<{ value: number }>).detail;
		const next = Number(detail?.value);
		if (Number.isNaN(next)) return;
		leftPanelWidth = clampSplitWidth(next, splitBounds);
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
		// telemetry events through the bridge. Hosts that need a different
		// shape of opt-out can still supply a custom `instrumentationProvider`.
		if (!isTelemetryEnabled(policies)) return;
		const localHost = hostElement;
		return attachInstrumentationEventBridge({
			host: localHost,
			instrumentationProvider,
			component: "pie-section-player-splitpane",
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
	toolbarPosition={isStacked ? "top" : toolbarPosition}
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
	sourceCe="pie-section-player-splitpane"
	host={hostElement}
	playerActionConfig={{
		stateKey: "__splitPaneAppliedParams",
		includeSessionRefInState: true,
	}}
	on:runtime-owned={forward}
	on:runtime-inherited={forward}
	on:section-controller-ready={forward}
	on:session-changed={forward}
	on:composition-changed={forward}
	on:element-preload-retry={forward}
	on:element-preload-error={forward}
	let:layoutModel
>
	{#if isStacked}
		{#if normalizedCollapseStrategy === "tabbed"}
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
				preloadComponentTag="pie-section-player-splitpane"
				idBase={`${paneIdBase}-tabbed`}
			/>
		{:else}
			<SectionPlayerVerticalContent
				{layoutModel}
				itemToolbarTools={layoutModel.itemToolbarTools}
				passageToolbarTools={layoutModel.passageToolbarTools}
				contentMaxWidthNoPassagePx={configuredContentMaxWidthNoPassagePx}
				contentMaxWidthWithPassagePx={configuredContentMaxWidthWithPassagePx}
				toolRegistry={layoutModel.toolRegistry}
				itemHostButtons={layoutModel.itemHostButtons}
				passageHostButtons={layoutModel.passageHostButtons}
				{iifeBundleHost}
				preloadComponentTag="pie-section-player-vertical"
			/>
		{/if}
	{:else}
		<div
			class="pie-section-player-split-frame"
			style={`--pie-section-player-layout-max-width: ${
				layoutModel.passages.length === 0
					? (configuredContentMaxWidthNoPassagePx !== undefined
						? `${configuredContentMaxWidthNoPassagePx}px`
						: "none")
					: (configuredContentMaxWidthWithPassagePx !== undefined
						? `${configuredContentMaxWidthWithPassagePx}px`
						: "none")
			};`}
		>
			<div
				class={`pie-section-player-split-content ${layoutModel.passages.length === 0 ? "pie-section-player-split-content--no-passages" : ""}`}
				bind:this={splitContainerElement}
				style={layoutModel.passages.length === 0
					? "grid-template-columns: 1fr"
					: `grid-template-columns: minmax(0, calc((100% - 0.5rem) * ${leftPanelWidth / 100})) 0.5rem minmax(0, calc((100% - 0.5rem) * ${(100 - leftPanelWidth) / 100}))`}
			>
				{#if layoutModel.passages.length > 0}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex scrollable pane needs keyboard focus -->
					<aside
						id={passagesPaneId}
						class="pie-section-player-passages-pane"
						aria-label="Passages"
						tabindex="0"
					>
						<pie-section-player-passages-pane
							passages={layoutModel.passages}
							elementsLoaded={layoutModel.paneElementsLoaded}
							resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
							resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
							resolvedPlayerProps={layoutModel.resolvedPlayerProps}
							playerStrategy={layoutModel.playerStrategy}
							passageToolbarTools={layoutModel.passageToolbarTools}
							toolRegistry={layoutModel.toolRegistry}
							hostButtons={layoutModel.passageHostButtons}
						></pie-section-player-passages-pane>
					</aside>

					<SectionSplitDivider
						value={leftPanelWidth}
						min={splitBounds.min}
						max={splitBounds.max}
						ariaLabel="Resize passages and items panels"
						ariaControls={passagesPaneId}
						ariaValueText={splitDividerValueText}
						on:resize-preview={handleSplitResizePreview}
						on:resize-commit={handleSplitResizePreview}
					/>
				{/if}

				<main
					id={itemsPaneId}
					class="pie-section-player-items-pane"
					aria-label="Items"
				>
					<pie-section-player-items-pane
						items={layoutModel.items}
						compositionModel={layoutModel.compositionModel}
						resolvedPlayerEnv={layoutModel.resolvedPlayerEnv}
						resolvedPlayerAttributes={layoutModel.resolvedPlayerAttributes}
						resolvedPlayerProps={layoutModel.resolvedPlayerProps}
						playerStrategy={layoutModel.playerStrategy}
						itemToolbarTools={layoutModel.itemToolbarTools}
						toolRegistry={layoutModel.toolRegistry}
						hostButtons={layoutModel.itemHostButtons}
						iifeBundleHost={iifeBundleHost}
						preloadedRenderables={layoutModel.preloadedRenderables}
						preloadedRenderablesSignature={layoutModel.preloadedRenderablesSignature}
						preloadComponentTag="pie-section-player-splitpane"
						preloadEnabled={layoutModel.preloadEnabled}
						onelements-loaded-change={layoutModel.onItemsPaneElementsLoaded}
						onelement-preload-retry={layoutModel.onItemsPanePreloadRetry}
						onelement-preload-error={layoutModel.onItemsPanePreloadError}
					></pie-section-player-items-pane>
				</main>
			</div>
		</div>
	{/if}
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

	.pie-section-player-split-frame {
		width: 100%;
		max-width: var(--pie-section-player-layout-max-width, none);
		height: 100%;
		min-height: 0;
		max-height: 100%;
		margin-inline: auto;
		overflow: hidden;
	}

	.pie-section-player-split-content {
		display: grid;
		gap: 0;
		min-height: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.pie-section-player-passages-pane,
	.pie-section-player-items-pane {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		padding: 0.5rem;
		box-sizing: border-box;
		background: var(--pie-background-dark, #ecedf1);
		scrollbar-width: thin;
		scrollbar-color:
			var(--pie-scrollbar-thumb, #6b7280) var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-passages-pane:focus-visible,
	.pie-section-player-items-pane:focus-visible {
		outline: 2px solid var(--pie-focus-outline, #1d4ed8);
		outline-offset: -2px;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar,
	.pie-section-player-items-pane::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-track,
	.pie-section-player-items-pane::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, #d1d5db);
		border-radius: 999px;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, #6b7280);
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, #d1d5db);
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb:hover,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, #4b5563);
	}

	.pie-section-player-observability-anchor {
		display: none;
	}

</style>
