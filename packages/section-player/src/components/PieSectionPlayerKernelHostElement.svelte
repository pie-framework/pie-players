<svelte:options
	customElement={{
		tag: "pie-section-player-kernel-host",
		// Keep light DOM so item/passage runtime content can inherit host/page styles.
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
			createSectionController: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
			iifeBundleHost: { attribute: "iife-bundle-host", type: "String" },
			debug: { attribute: "debug", type: "String" },
			showToolbar: { attribute: "show-toolbar", type: "String" },
			toolbarPosition: { attribute: "toolbar-position", type: "String" },
			enabledTools: { attribute: "enabled-tools", type: "String" },
			itemToolbarTools: { attribute: "item-toolbar-tools", type: "String" },
			passageToolbarTools: { attribute: "passage-toolbar-tools", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			sectionHostButtons: { type: "Object", reflect: false },
			itemHostButtons: { type: "Object", reflect: false },
			passageHostButtons: { type: "Object", reflect: false },
			policies: { type: "Object", reflect: false },
			hooks: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import type {
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
	import SectionPlayerLayoutKernel from "./shared/SectionPlayerLayoutKernel.svelte";
	import type {
		SectionPlayerRuntimeHostContract,
		SectionPlayerSnapshot,
	} from "../contracts/runtime-host-contract.js";
	import type { SectionPlayerHostHooks } from "../contracts/host-hooks.js";
	import type { RuntimeConfig } from "./shared/section-player-runtime.js";

	let {
		assessmentId,
		runtime = null as RuntimeConfig | null,
		section = null,
		sectionId = "",
		attemptId = "",
		playerType,
		player = null as Record<string, unknown> | null,
		lazyInit,
		tools,
		accessibility,
		coordinator,
		createSectionController,
		isolation,
		env,
		iifeBundleHost,
		debug = undefined as string | boolean | undefined,
		showToolbar = "false",
		toolbarPosition = "right",
		enabledTools = "",
		itemToolbarTools = "",
		passageToolbarTools = "",
		toolRegistry = null as ToolRegistry | null,
		sectionHostButtons = [] as ToolbarItem[],
		itemHostButtons = [] as ToolbarItem[],
		passageHostButtons = [] as ToolbarItem[],
		policies,
		hooks = undefined as SectionPlayerHostHooks | undefined,
	} = $props();

	const dispatch = createEventDispatcher();
	let anchor = $state<HTMLDivElement | null>(null);
	let kernelRef = $state<SectionPlayerRuntimeHostContract | null>(null);
	let snapshot = $state<SectionPlayerSnapshot>({
		readiness: {
			phase: "bootstrapping",
			interactionReady: false,
			allLoadingComplete: false,
		},
		composition: {
			itemsCount: 0,
			passagesCount: 0,
		},
		navigation: {
			currentIndex: 0,
			totalItems: 0,
			canNext: false,
			canPrevious: false,
		},
	});
	const instrumentationProvider = $derived.by(() =>
		resolveInstrumentationProvider({
			runtimePlayer: runtime?.player,
			player,
			component: "pie-section-player-kernel-host",
		}),
	);

	function getHostElement(): HTMLElement | null {
		if (!anchor) return null;
		const rootNode = anchor.getRootNode();
		if (rootNode && "host" in rootNode) {
			return (rootNode as ShadowRoot).host as HTMLElement;
		}
		return anchor.parentElement as HTMLElement | null;
	}
	const hostElement = $derived.by(() => getHostElement());

	export function getSnapshot(): SectionPlayerSnapshot {
		return snapshot;
	}

	export function selectComposition(): SectionPlayerSnapshot["composition"] {
		return snapshot.composition;
	}

	export function selectNavigation(): SectionPlayerSnapshot["navigation"] {
		return kernelRef?.selectNavigation?.() || snapshot.navigation;
	}

	export function selectReadiness(): SectionPlayerSnapshot["readiness"] {
		return snapshot.readiness;
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

	function reemit(event: Event) {
		const customEvent = event as CustomEvent;
		dispatch(customEvent.type, customEvent.detail);
	}

	function syncNavigationSnapshot() {
		snapshot = {
			...snapshot,
			navigation: kernelRef?.selectNavigation?.() || snapshot.navigation,
		};
	}

	$effect(() => {
		if (!hostElement) return;
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
	{createSectionController}
	{isolation}
	{env}
	{iifeBundleHost}
	{debug}
	{showToolbar}
	{toolbarPosition}
	{enabledTools}
	{itemToolbarTools}
	{passageToolbarTools}
	{toolRegistry}
	{sectionHostButtons}
	{itemHostButtons}
	{passageHostButtons}
	{policies}
	{hooks}
	on:readiness-change={(event: CustomEvent) => {
		const detail = (event as CustomEvent).detail;
		snapshot = { ...snapshot, readiness: detail };
		reemit(event);
	}}
	on:interaction-ready={reemit}
	on:ready={reemit}
	on:runtime-error={reemit}
	on:framework-error={reemit}
	on:runtime-owned={reemit}
	on:runtime-inherited={reemit}
	on:section-controller-ready={reemit}
	on:session-changed={reemit}
	on:composition-changed={(event: CustomEvent) => {
		const detail = (event as CustomEvent).detail as {
			composition?: { items?: unknown[]; passages?: unknown[] };
		};
		const items = detail?.composition?.items || [];
		const passages = detail?.composition?.passages || [];
		snapshot = {
			...snapshot,
			composition: {
				itemsCount: items.length,
				passagesCount: passages.length,
			},
		};
		syncNavigationSnapshot();
		reemit(event);
	}}
	on:element-preload-retry={reemit}
	on:element-preload-error={reemit}
	let:items
	let:passages
	let:compositionModel
	let:resolvedPlayerEnv
	let:resolvedPlayerAttributes
	let:resolvedPlayerProps
	let:playerStrategy
	let:preloadedRenderables
	let:preloadedRenderablesSignature
	let:onItemsPaneElementsLoaded
	let:onItemsPanePreloadRetry
	let:onItemsPanePreloadError
>
	<div class="pie-section-player-kernel-host-content">
		{#if passages.length > 0}
			<pie-section-player-passages-pane
				{passages}
				elementsLoaded={snapshot.readiness.allLoadingComplete}
				{resolvedPlayerEnv}
				{resolvedPlayerAttributes}
				{resolvedPlayerProps}
				{playerStrategy}
				passageToolbarTools={passageToolbarTools}
				{toolRegistry}
				hostButtons={passageHostButtons}
			></pie-section-player-passages-pane>
		{/if}
		<pie-section-player-items-pane
			{items}
			{compositionModel}
			{resolvedPlayerEnv}
			{resolvedPlayerAttributes}
			{resolvedPlayerProps}
			{playerStrategy}
			itemToolbarTools={itemToolbarTools}
			{toolRegistry}
			hostButtons={itemHostButtons}
			iifeBundleHost={iifeBundleHost}
			preloadedRenderables={preloadedRenderables}
			preloadedRenderablesSignature={preloadedRenderablesSignature}
			preloadComponentTag="pie-section-player-kernel-host"
			onelements-loaded-change={onItemsPaneElementsLoaded}
			onelement-preload-retry={onItemsPanePreloadRetry}
			onelement-preload-error={onItemsPanePreloadError}
		></pie-section-player-items-pane>
	</div>
</SectionPlayerLayoutKernel>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player-kernel-host-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		height: 100%;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.pie-section-player-observability-anchor {
		display: none;
	}
</style>
