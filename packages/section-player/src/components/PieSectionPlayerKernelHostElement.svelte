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
