<svelte:options
	customElement={{
		tag: "pie-section-player-splitpane",
		// Use light DOM so item-player/runtime styles can cascade into rendered item content.
		shadow: "none",
		props: {
			runtime: { type: "Object", reflect: false },
			// Presentation flag: opt in to NDS icon buttons. Unset renders plain
			// <button>s.
			ndsIcons: { attribute: "nds-icons", type: "Boolean" },
			// Interface locale: the language the player renders its own UI in, as a
			// BCP-47 tag. Unset renders `en-US`. Distinct from the authored content
			// language, which travels on `runtime.contentLanguage`.
			locale: { attribute: "locale", type: "String" },
			section: { type: "Object", reflect: false },
			// The section's session, applied by the controller created for
			// `section` in place of hydrating from the persistence strategy.
			session: { type: "Object", reflect: false },
			// The assessment entity whose `personalNeedsProfile` and `settings` the
			// toolkit's tool policy reads, forwarded to the coordinator it builds.
			assessment: { type: "Object", reflect: false },
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
		// The host methods, callable before the component mounts.
		extend: (ElementClass) =>
			coerceBooleanAttributes(withHostMethods(null)(ElementClass)),
	}}
/>

<script lang="ts">
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		SECTION_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import "./section-player-item-card-element.js";
	import "./section-player-passage-card-element.js";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import { isOwnSectionPlayerEvent } from "./shared/section-player-own-event.js";
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import { withHostMethods } from "./shared/layout-host-methods.js";
	import SectionPlayerTabbedContent from "./shared/SectionPlayerTabbedContent.svelte";
	import SectionPlayerVerticalContent from "./shared/SectionPlayerVerticalContent.svelte";
	// TS language service false-positive in this workspace: Svelte component has a default export.
	// @ts-ignore false-positive no-default-export in IDE language service for this import
	import SectionSplitDivider from "./shared/SectionSplitDivider.svelte";
	import { useInterfaceI18n } from "./shared/use-interface-i18n.svelte.js";
	import { untrack } from "svelte";
	import type {
		ToolConfigStrictness,
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import type {
		AssessmentEntity,
		AssessmentSection,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import {
		resolveSectionId,
		type RuntimeConfig,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerPolicies } from "../policies/types.js";
	import { resolveSectionPlayerPolicies } from "../policies/index.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";
	import {
		clampNarrowBreakpoint,
		createNarrowLayoutWatch,
		resolveConfiguredPx,
		resolveContentMaxWidths,
	} from "./shared/section-player-shell-layout.svelte.js";
	import { getHostElementFromAnchor } from "./shared/host-element.js";

	const SPLIT_PANE_MIN_REGION_MIN_PX = 160;
	const SPLIT_PANE_MIN_REGION_MAX_PX = 1200;
	const SPLIT_DIVIDER_TRACK_REM = 0.5;
	const SPLIT_LEFT_PERCENT_MIN = 20;
	const SPLIT_LEFT_PERCENT_MAX = 80;

	type SplitBounds = {
		min: number;
		max: number;
	};

	function clampSplitWidth(next: number, bounds: SplitBounds): number {
		return Math.max(bounds.min, Math.min(bounds.max, next));
	}

	// Coerce a host-supplied initial passage width (number, numeric string, or
	// undefined) into a percent inside the static SPLIT_LEFT_PERCENT_MIN..MAX
	// envelope. Returns undefined for missing / non-numeric input so callers
	// can fall back to the 50% mid-default. The dynamic per-container bounds
	// (which can be tighter when splitPaneMinRegionWidth is set) are applied
	// later by the existing splitBounds reactive effect — keeping the prop's
	// clamp envelope static makes the contract viewport-independent.
	function resolveInitialPassageWidthPercent(value: unknown): number | undefined {
		if (value === undefined || value === null || value === "") return undefined;
		const num = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(num)) return undefined;
		return Math.max(SPLIT_LEFT_PERCENT_MIN, Math.min(SPLIT_LEFT_PERCENT_MAX, num));
	}

	function getDividerTrackPx(container: HTMLElement): number {
		const fontSizePx = Number.parseFloat(getComputedStyle(container).fontSize || "16");
		const safeFontSizePx = Number.isFinite(fontSizePx) && fontSizePx > 0 ? fontSizePx : 16;
		return safeFontSizePx * SPLIT_DIVIDER_TRACK_REM;
	}

	/**
	 * Horizontal space a pane spends on its own gutter, which is margin rather than
	 * padding so the gutter sits outside the scrollable region.
	 *
	 * Measured rather than read from the constant the stylesheet uses, so a theme or
	 * host override that changes the gutter cannot silently shrink the region a host
	 * asked to guarantee.
	 */
	function getPaneGutterPx(container: HTMLElement): number {
		const pane = container.querySelector<HTMLElement>(
			".pie-section-player-passages-pane, .pie-section-player-items-pane",
		);
		if (!pane) return 0;
		const style = getComputedStyle(pane);
		const left = Number.parseFloat(style.marginLeft || "0");
		const right = Number.parseFloat(style.marginRight || "0");
		const total = (Number.isFinite(left) ? left : 0) + (Number.isFinite(right) ? right : 0);
		return total > 0 ? total : 0;
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
		// The bound is on the region, not on the grid track it sits in: each pane
		// spends its gutter out of its own track, so the track is the requested
		// region width plus that gutter.
		const trackWidthPx = minRegionWidthPx + getPaneGutterPx(container);
		const rawMinPercent = (trackWidthPx / usableWidthPx) * 100;
		if (!Number.isFinite(rawMinPercent) || rawMinPercent >= 50) {
			return { min: 50, max: 50 };
		}
		const min = Math.max(SPLIT_LEFT_PERCENT_MIN, rawMinPercent);
		const max = Math.min(SPLIT_LEFT_PERCENT_MAX, Math.max(min, 100 - min));
		return { min, max };
	}

	let {
		runtime = null as RuntimeConfig | null,
		ndsIcons = undefined as boolean | undefined,
		locale = "",
		section = null as AssessmentSection | null,
		session = null as SectionControllerSessionState | null,
		assessment = null as AssessmentEntity | null,
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
		policies = undefined as Partial<SectionPlayerPolicies> | undefined,
		hooks = undefined as SectionPlayerHostHooks | undefined,
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
		narrowLayoutBreakpoint = undefined as number | undefined,
		contentMaxWidthNoPassage = undefined as number | undefined,
		contentMaxWidthWithPassage = undefined as number | undefined,
		splitPaneMinRegionWidth = undefined as number | undefined,
		splitPaneInitialPassageWidth = undefined as number | string | undefined,
		splitPaneCollapseStrategy = "tabbed" as "vertical" | "tabbed" | string,
	} = $props();

	// Snapshot of the resolved prop at mount. Renders the divider in the
	// right place on the first frame (so consumers don't see a 50% flash
	// before the $effect below reapplies), and seeds the change-detection
	// state used by that effect.
	const initialPassageWidthPercent = untrack(
		() => resolveInitialPassageWidthPercent(splitPaneInitialPassageWidth) ?? 50,
	);
	let lastAppliedInitialWidth = $state<number | undefined>(
		untrack(() =>
			resolveInitialPassageWidthPercent(splitPaneInitialPassageWidth),
		),
	);

	const clampedBreakpoint = $derived(
		clampNarrowBreakpoint(narrowLayoutBreakpoint),
	);
	const narrowLayout = createNarrowLayoutWatch(() => clampedBreakpoint);

	let leftPanelWidth = $state(initialPassageWidthPercent);
	let splitBounds = $state<SplitBounds>({ min: 20, max: 80 });
	let splitContainerElement = $state<HTMLDivElement | null>(null);
	// `splitContainerElement` is inside `<pie-assessment-toolkit>`, so a context
	// request from it reaches the published provider.
	const interfaceI18n = useInterfaceI18n(() => splitContainerElement);
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	const paneIdBase = $derived.by(() =>
		`pie-section-player-splitpane-${(sectionId || attemptId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`
	);
	const passagesPaneId = $derived(`${paneIdBase}-passages`);
	const itemsPaneId = $derived(`${paneIdBase}-items`);
	const splitDividerValueText = $derived(`${Math.round(leftPanelWidth)}% passages width`);
	const contentMaxWidths = $derived(
		resolveContentMaxWidths(contentMaxWidthNoPassage, contentMaxWidthWithPassage),
	);
	const configuredContentMaxWidthNoPassagePx = $derived(
		contentMaxWidths.noPassagePx,
	);
	const configuredContentMaxWidthWithPassagePx = $derived(
		contentMaxWidths.withPassagePx,
	);
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
			component: "pie-section-player-splitpane",
		}),
	);

	const hostElement = $derived.by(() => getHostElementFromAnchor(anchor));


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

	// Re-apply splitPaneInitialPassageWidth when the host changes it after
	// mount (e.g. via setAttribute / property assignment / inspect-element
	// edits). Idempotent: we compare the *resolved* (coerced + clamped) value
	// to the last applied one, so host re-renders that re-assign the same
	// number don't stomp on a user's drag — only an actual change snaps the
	// divider. `untrack` around the writes prevents this effect from
	// retriggering itself through `lastAppliedInitialWidth`/`leftPanelWidth`.
	$effect(() => {
		const resolved = resolveInitialPassageWidthPercent(
			splitPaneInitialPassageWidth,
		);
		untrack(() => {
			if (resolved === lastAppliedInitialWidth) return;
			lastAppliedInitialWidth = resolved;
			if (resolved === undefined) return;
			leftPanelWidth = clampSplitWidth(resolved, splitBounds);
		});
	});

	function handleSplitResize(next: number) {
		if (!splitContainerElement) return;
		if (Number.isNaN(next)) return;
		leftPanelWidth = clampSplitWidth(next, splitBounds);
	}

	export function getSnapshot(): SectionPlayerSnapshot | null {
		return kernelRef?.getSnapshot?.() ?? null;
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

	$effect(() => {
		if (!hostElement) return;
		// `policies.telemetry.enabled === false` skips instrumentation bridge
		// setup entirely so hosts that opt out emit no `pie-section-*`
		// telemetry events through the bridge. Hosts that need a different
		// shape of opt-out can still supply a custom `instrumentationProvider`.
		if (!resolveSectionPlayerPolicies(policies).telemetry.enabled) return;
		const localHost = hostElement;
		return attachInstrumentationEventBridge({
			host: localHost,
			instrumentationProvider,
			component: "pie-section-player-splitpane",
			eventMap: SECTION_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "section",
				assessmentId: runtime?.assessmentId,
				sectionId: resolveSectionId({
					sectionId,
					section,
					assessmentId: runtime?.assessmentId,
				}),
				attemptId: attemptId || undefined,
			},
			shouldTrackEvent: (event: Event) =>
				isOwnSectionPlayerEvent(event, localHost),
			dedupeWindowMs: 100,
		});
	});

</script>

<div bind:this={anchor} class="pie-section-player-observability-anchor" aria-hidden="true"></div>
<SectionPlayerLayoutKernel
	bind:this={kernelRef}
	{runtime}
	{ndsIcons}
	{locale}
	{section}
	{session}
	{assessment}
	{sectionId}
	{attemptId}
	{iifeBundleHost}
	{debug}
	{baseHeadingLevel}
	{showToolbar}
	toolbarPosition={narrowLayout.isNarrow ? "top" : toolbarPosition}
	{toolRegistry}
	{sectionHostButtons}
	{itemHostButtons}
	{passageHostButtons}
	{policies}
	{hooks}
	{toolConfigStrictness}
	sourceCe="pie-section-player-splitpane"
	host={hostElement}
	playerActionConfig={{
		stateKey: "__splitPaneAppliedParams",
		includeSessionRefInState: true,
	}}
	let:layoutModel
>
	{#if narrowLayout.isNarrow}
		{#if normalizedCollapseStrategy === "tabbed"}
			<SectionPlayerTabbedContent
				{layoutModel}
				contentMaxWidthNoPassagePx={configuredContentMaxWidthNoPassagePx}
				contentMaxWidthWithPassagePx={configuredContentMaxWidthWithPassagePx}
				idBase={`${paneIdBase}-tabbed`}
			/>
		{:else}
			<SectionPlayerVerticalContent
				{layoutModel}
				contentMaxWidthNoPassagePx={configuredContentMaxWidthNoPassagePx}
				contentMaxWidthWithPassagePx={configuredContentMaxWidthWithPassagePx}
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
					<aside
						id={passagesPaneId}
						class="pie-section-player-passages-pane"
						aria-label={interfaceI18n.t("player.passagesRegionA11y")}
					>
						<pie-section-player-passages-pane></pie-section-player-passages-pane>
					</aside>

					<SectionSplitDivider
						value={leftPanelWidth}
						min={splitBounds.min}
						max={splitBounds.max}
						ariaLabel={interfaceI18n.t("player.resizePassagesAndItemsA11y")}
						ariaControls={passagesPaneId}
						ariaValueText={splitDividerValueText}
						onResize={handleSplitResize}
					/>
				{/if}

				<main
					id={itemsPaneId}
					class="pie-section-player-items-pane"
					aria-label={interfaceI18n.t("player.itemsRegionA11y")}
				>
					<pie-section-player-items-pane></pie-section-player-items-pane>
				</main>
			</div>
		</div>
	{/if}
</SectionPlayerLayoutKernel>

<style>
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
		/* Margin (not padding) so the gutter sits outside the scrollable
		   region. Padding lives inside the scroll box, letting any child
		   that uses position:sticky bleed into it as content scrolls past. */
		margin: 0.5rem;
		box-sizing: border-box;
		/* Backdrop for the scroll surround behind the cards. Deliberately the
		   canonical surface token and not --pie-passage-header-background: that
		   is a passage header hook, and this rule also covers the items pane,
		   which holds no passage header, so a host coloring its hosted
		   passage-player's header used to repaint both pane backdrops. There is
		   no pane-specific hook on purpose — the backdrop is meant to stay with
		   the theme, which is what tracks dark themes and color schemes.
		   --pie-background-dark resolves to #ecedf1 in the default light theme. */
		background: var(--pie-background-dark, #ecedf1);
		scrollbar-width: thin;
		scrollbar-color:
			var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280)) var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-items-pane :global(.pie-section-player-scroll-hint) {
	    bottom: -0.5rem;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar,
	.pie-section-player-items-pane::-webkit-scrollbar {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-track,
	.pie-section-player-items-pane::-webkit-scrollbar-track {
		background: var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
		border-radius: 999px;
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb {
		background: var(--pie-scrollbar-thumb, var(--pie-border-gray, #6b7280));
		border-radius: 999px;
		border: 2px solid var(--pie-scrollbar-track, var(--pie-background-dark, #d1d5db));
	}

	.pie-section-player-passages-pane::-webkit-scrollbar-thumb:hover,
	.pie-section-player-items-pane::-webkit-scrollbar-thumb:hover {
		background: var(--pie-scrollbar-thumb-hover, var(--pie-border-dark, #4b5563));
	}

	.pie-section-player-observability-anchor {
		display: none;
	}

</style>
