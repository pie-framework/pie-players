<svelte:options
	customElement={{
		tag: "pie-section-player-kernel-host",
		// The shadow root holds the player's chrome and one slot. The panes, and
		// the item and passage content in them, stay in light DOM, where host and
		// page styles reach them.
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			runtime: { type: "Object", reflect: false },
			section: { type: "Object", reflect: false },
			// The section's session, applied by the controller created for
			// `section` in place of hydrating from the persistence strategy.
			session: { type: "Object", reflect: false },
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
		},
		// The host methods, callable before the component mounts.
		extend: withHostMethods(BOOTSTRAP_READS),
	}}
/>

<script lang="ts">
	import { createEventDispatcher, mount, unmount } from "svelte";
	import type {
		FrameworkErrorModel,
		ToolConfigStrictness,
		ToolRegistry,
		ToolbarItem,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		attachInstrumentationEventBridge,
		resolveInstrumentationProvider,
		SECTION_INSTRUMENTATION_EVENT_MAP,
	} from "@pie-players/pie-players-shared/pie";
	import "./section-player-items-pane-element.js";
	import "./section-player-passages-pane-element.js";
	import { isOwnSectionPlayerEvent } from "./shared/section-player-own-event.js";
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import SectionPlayerKernelHostBody from "./shared/SectionPlayerKernelHostBody.svelte";
	import { attachKernelHostDefaultBody } from "./shared/kernel-host-default-body.js";
	import {
		BOOTSTRAP_READINESS,
		BOOTSTRAP_READS,
		BOOTSTRAP_SNAPSHOT,
		withHostMethods,
	} from "./shared/layout-host-methods.js";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";
	import type {
		RuntimeConfig,
		StageChangeHandler,
		LoadingCompleteHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import type { SectionPlayerPolicies } from "../policies/types.js";
	import { isTelemetryEnabled } from "../policies/index.js";
	import { getHostElementFromAnchor } from "./shared/host-element.js";

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null,
		session = null,
		sectionId = "",
		attemptId = "",
		iifeBundleHost,
		debug = undefined as string | boolean | undefined,
		baseHeadingLevel = undefined as number | undefined,
		showToolbar = "false",
		toolbarPosition = "right",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		policies = undefined as Partial<SectionPlayerPolicies> | undefined,
		hooks = undefined as SectionPlayerHostHooks | undefined,
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
		onFrameworkError = undefined as
			| undefined
			| ((model: FrameworkErrorModel) => void),
		onStageChange = undefined as StageChangeHandler | undefined,
		onLoadingComplete = undefined as LoadingCompleteHandler | undefined,
	} = $props();
	// Two-tier resolution for `onFrameworkError` is handled by the
	// kernel's resolver (`resolveSectionPlayerRuntimeState` →
	// `effectiveRuntime.onFrameworkError`); the CE forwards the
	// top-level prop and `runtime` verbatim and the resolver picks
	// `runtime.onFrameworkError` over `onFrameworkError`.

	const dispatch = createEventDispatcher();
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			component: "pie-section-player-kernel-host",
		}),
	);

	const hostElement = $derived.by(() => getHostElementFromAnchor(anchor));

	export function getSnapshot(): SectionPlayerSnapshot {
		return {
			readiness: selectReadiness(),
			composition: selectComposition(),
			navigation: selectNavigation(),
		};
	}

	export function selectComposition(): SectionPlayerSnapshot["composition"] {
		return kernelRef?.selectComposition?.() || BOOTSTRAP_SNAPSHOT.composition;
	}

	export function selectNavigation(): SectionPlayerSnapshot["navigation"] {
		return kernelRef?.selectNavigation?.() || BOOTSTRAP_SNAPSHOT.navigation;
	}

	export function selectReadiness(): SectionPlayerSnapshot["readiness"] {
		return kernelRef?.selectReadiness?.() || BOOTSTRAP_READINESS;
	}

	export function navigateTo(_index: number): boolean {
		return kernelRef?.navigateTo?.(_index) === true;
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

	function reemit(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	// A host that places its own panes as children gets its layout; one that
	// gives the element none gets the stock one.
	$effect(() => {
		if (!hostElement) return;
		return attachKernelHostDefaultBody(hostElement, (target) => {
			const body = mount(SectionPlayerKernelHostBody, { target });
			return () => {
				void unmount(body);
			};
		});
	});

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
			component: "pie-section-player-kernel-host",
			eventMap: SECTION_INSTRUMENTATION_EVENT_MAP,
			staticAttributes: {
				instrumentationLayer: "section",
				assessmentId,
				sectionId,
				attemptId: attemptId || undefined,
			},
			shouldTrackEvent: (event: Event) =>
				isOwnSectionPlayerEvent(event, localHost),
			dedupeWindowMs: 100,
		});
	});

	// Engine-owned events (`pie-stage-change`, `pie-loading-complete`)
	// are dispatched by the kernel-owned section runtime engine directly
	// onto this CE element via its DOM-event bridge, and the toolkit's own
	// events (`framework-error`, `session-changed`, `composition-changed`,
	// `runtime-owned`, `runtime-inherited`, `toolkit-ready`,
	// `section-ready`) bubble to it from the toolkit, so
	// outside listeners on `<pie-section-player-kernel-host>` see each once
	// without any CE-level re-emission. Snapshots are read on demand from
	// the kernel, which owns the canonical composition, navigation and
	// readiness state.
</script>

<div bind:this={anchor} class="pie-section-player-observability-anchor" aria-hidden="true"></div>
<SectionPlayerLayoutKernel
	bind:this={kernelRef}
	{assessmentId}
	{runtime}
	{section}
	{session}
	{sectionId}
	{attemptId}
	{iifeBundleHost}
	{debug}
	{baseHeadingLevel}
	{showToolbar}
	{toolbarPosition}
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
	sourceCe="pie-section-player-kernel-host"
	host={hostElement}
	on:element-preload-retry={reemit}
	on:element-preload-error={reemit}
>
	<slot></slot>
</SectionPlayerLayoutKernel>

<style>
	.pie-section-player-observability-anchor {
		display: none;
	}
</style>
