<svelte:options
	customElement={{
		tag: "pie-section-player-kernel-host",
		// The shadow root holds the player's chrome and one slot. The panes, and
		// the item and passage content in them, stay in light DOM, where host and
		// page styles reach them.
		shadow: "open",
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
		},
		// The host methods, callable before the component mounts.
		extend: (ElementClass) =>
			coerceBooleanAttributes(withHostMethods(BOOTSTRAP_SNAPSHOT)(ElementClass)),
	}}
/>

<!--
@component
Section player for a host that lays out the section itself: it runs the toolkit, section controller, readiness, element pre-warm and section toolbar in its shadow root, and its element children are the layout, holding `pie-section-player-items-pane` and `pie-section-player-passages-pane` at any depth. With no element children it renders the passages pane above the items pane. The element has no styles of its own, so the host gives it `display` and a height.

@fires {CustomEvent<StageChangeDetail>} pie-stage-change - When the section enters `composed`, `engine-ready`, `interactive` or `disposed`, or a framework error fails or skips a stage.
@fires {CustomEvent<LoadingCompleteDetail>} pie-loading-complete - Once per section and attempt, when the element pre-warm resolves and the item cards can mount.
@fires {CustomEvent<{ componentTag: string; stage: "validate-config" | "iife-load" | "esm-load" | "preloaded-assert"; attempt: number; maxRetries: number; error: string; strategy: string; bundleType: string | null; bundleHost: string; renderablesCount: number; assessmentId?: string; sectionId: string; attemptId?: string }>} element-preload-retry - When the rendering items pane's element pre-warm retries a failed load.
@fires {CustomEvent<{ componentTag: string; stage: "validate-config" | "iife-load" | "esm-load" | "preloaded-assert"; error: string; strategy: string; bundleType: string | null; bundleHost: string; renderablesCount: number; assessmentId?: string; sectionId: string; attemptId?: string }>} element-preload-error - When the rendering items pane's element pre-warm fails.
@fires {CustomEvent<FrameworkErrorModel>} framework-error - Bubbles from the inner toolkit. For each framework error the runtime reports; a non-recoverable bootstrap error also shows an error banner in place of the slotted content.
@fires {CustomEvent<{ composition: unknown; version: number }>} composition-changed - Bubbles from the inner toolkit. When the bound section's composition changes revision, with a version that increases on each change.
@fires {CustomEvent<{ itemId: string; canonicalItemId: string; sourceRuntimeId: string } & Record<string, unknown>>} session-changed - Bubbles from the inner toolkit. When an item's session in the bound section changes, carrying the section's canonical session detail for that item.
@fires {CustomEvent<{ runtimeId: string; parentRuntimeId: string | null }>} runtime-owned - Bubbles from the inner toolkit. When the toolkit starts running its own coordinator.
@fires {CustomEvent<{ runtimeId: string; parentRuntimeId: string | null }>} runtime-inherited - Bubbles from the inner toolkit. When the toolkit adopts an outer toolkit's coordinator, named by `parentRuntimeId`.
@fires {CustomEvent<{ runtimeId: string; coordinator: ToolkitCoordinator; ownership: "owned" | "inherited" }>} runtime-ready - Bubbles from the inner toolkit. Once per coordinator, with or without a section, from which point a host can drive it.
@fires {CustomEvent<{ runtimeId: string; assessmentId: string; sectionId: string; itemPlayer: ItemPlayerConfig; coordinator: ToolkitCoordinator }>} toolkit-ready - Bubbles from the inner toolkit. For every section the toolkit initializes, once its section controller resolves.
@fires {CustomEvent<{ sectionId: string; attemptId: string; controller: unknown }>} section-ready - Bubbles from the inner toolkit. Right after `toolkit-ready`, with the section's controller or null.
@fires {CustomEvent<{ itemId: string; canonicalItemId: string; session: unknown; sessionCommitReason?: "teardown" | "navigate" | "page-hidden" }>} item-session-changed - Bubbles from an item scope when the item player reports a response change; the player's own `session-changed` stops at the scope.
@slot - The host's layout, holding the items pane and, optionally, the passages pane.
-->

<script lang="ts">
	import { mount, unmount } from "svelte";
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import type {
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
		BOOTSTRAP_SNAPSHOT,
		withHostMethods,
	} from "./shared/layout-host-methods.js";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";
	import {
		resolveSectionId,
		type RuntimeConfig,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";
	import type { SectionPlayerPolicies } from "../policies/types.js";
	import { resolveSectionPlayerPolicies } from "../policies/index.js";
	import { getHostElementFromAnchor } from "./shared/host-element.js";

	let {
		runtime = null as RuntimeConfig | null,
		ndsIcons = undefined as boolean | undefined,
		locale = "",
		section = null,
		session = null,
		assessment = null,
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
	} = $props();

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
		return kernelRef?.getSnapshot?.() || BOOTSTRAP_SNAPSHOT;
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
		if (!resolveSectionPlayerPolicies(policies).telemetry.enabled) return;
		const localHost = hostElement;
		return attachInstrumentationEventBridge({
			host: localHost,
			instrumentationProvider,
			component: "pie-section-player-kernel-host",
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

	// Engine-owned events (`pie-stage-change`, `pie-loading-complete`)
	// are dispatched by the kernel-owned section runtime engine directly
	// onto this CE element via its DOM-event bridge, and the toolkit's own
	// events (`framework-error`, `session-changed`, `composition-changed`,
	// `runtime-owned`, `runtime-inherited`, `toolkit-ready`,
	// `section-ready`) bubble to it from the toolkit, so
	// outside listeners on `<pie-section-player-kernel-host>` see each once
	// without any CE-level re-emission. Snapshots are read on demand from
	// the kernel, which owns the composition and navigation state.
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
	{toolbarPosition}
	{toolRegistry}
	{sectionHostButtons}
	{itemHostButtons}
	{passageHostButtons}
	{policies}
	{hooks}
	{toolConfigStrictness}
	sourceCe="pie-section-player-kernel-host"
	host={hostElement}
>
	<slot></slot>
</SectionPlayerLayoutKernel>

<style>
	.pie-section-player-observability-anchor {
		display: none;
	}
</style>
