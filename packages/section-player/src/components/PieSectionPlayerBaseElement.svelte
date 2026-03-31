<svelte:options
	customElement={{
		tag: "pie-section-player-base",
		shadow: "open",
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
			toolRegistry: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			frameworkErrorHook: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element";
	import {
		createDefaultPersonalNeedsProfile,
		type ToolRegistry,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		normalizeToolsConfig,
		resolveToolsForLevel,
	} from "@pie-players/pie-assessment-toolkit";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher } from "svelte";
	import { SectionController } from "../controllers/SectionController.js";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
	import { EMPTY_COMPOSITION } from "./shared/composition.js";
	import {
		DEFAULT_ASSESSMENT_ID,
		DEFAULT_ENV,
		DEFAULT_ISOLATION,
		DEFAULT_LAZY_INIT,
		DEFAULT_PLAYER_TYPE,
		type RuntimeConfig,
	} from "./shared/section-player-runtime.js";
	let {
		assessmentId = DEFAULT_ASSESSMENT_ID,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		playerType = DEFAULT_PLAYER_TYPE,
		player = null as Record<string, unknown> | null,
		lazyInit = DEFAULT_LAZY_INIT,
		tools = null as Record<string, unknown> | null,
		toolRegistry = null as ToolRegistry | null,
		accessibility = null as Record<string, unknown> | null,
		coordinator = null as unknown,
		createSectionController = null as unknown,
		frameworkErrorHook: _frameworkErrorHook = undefined as
			| undefined
			| ((errorModel: Record<string, unknown>) => void),
		isolation = DEFAULT_ISOLATION,
		env = null as Record<string, unknown> | null,
	} = $props();

	let toolkitElement = $state<any>(null);
	let activeToolkitCoordinator = $state<any>(null);
	let lastCompositionVersion = $state(-1);
	type BaseSectionPlayerEvents = {
		"composition-changed": { composition: SectionCompositionModel };
		"toolkit-ready": Record<string, unknown>;
		"section-ready": Record<string, unknown>;
		"runtime-error": Record<string, unknown>;
		"framework-error": Record<string, unknown>;
		"session-changed": Record<string, unknown>;
		"runtime-owned": Record<string, unknown>;
		"runtime-inherited": Record<string, unknown>;
	};
	const dispatch = createEventDispatcher<BaseSectionPlayerEvents>();
	const effectiveAssessmentId = $derived.by(() => runtime?.assessmentId ?? assessmentId);
	const effectivePlayerType = $derived.by(() => runtime?.playerType ?? playerType);
	const effectivePlayer = $derived.by(() => runtime?.player ?? player);
	const effectiveLazyInit = $derived.by(() => runtime?.lazyInit ?? lazyInit);
	const effectiveTools = $derived.by(() => runtime?.tools ?? tools);
	const effectiveToolConfigStrictness = $derived.by(() => {
		const value = runtime?.toolConfigStrictness;
		return value === "off" || value === "warn" || value === "error"
			? value
			: "error";
	});
	const effectiveAccessibility = $derived.by(
		() => runtime?.accessibility ?? accessibility,
	);
	const effectiveCoordinator = $derived.by(() => runtime?.coordinator ?? coordinator);
	const effectiveCreateSectionController = $derived.by(
		() => runtime?.createSectionController ?? createSectionController,
	);
	const effectiveIsolation = $derived.by(() => runtime?.isolation ?? isolation);
	const effectiveEnv = $derived.by(() => runtime?.env ?? env ?? DEFAULT_ENV);
	const effectiveSectionId = $derived.by(
		() => sectionId || (resolvedSection as any)?.identifier || "",
	);
	let resolvedSection = $derived.by(() => {
		if (!section) return null;
		const sectionAny = section as any;
		const hasExplicitPnp = Boolean(
			sectionAny?.personalNeedsProfile || sectionAny?.settings?.personalNeedsProfile,
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile(),
		};
	});

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
			activeToolkitCoordinator = detail.coordinator;
		}
		emit(eventName, detail || ({} as Record<string, unknown>));
	}

	function handleToolkitReadyEvent(event: Event): void {
		handleToolkitEvent(event, "toolkit-ready");
	}

	function handleSectionReadyEvent(event: Event): void {
		handleToolkitEvent(event, "section-ready");
	}

	function handleRuntimeErrorEvent(event: Event): void {
		handleToolkitEvent(event, "runtime-error");
	}

	function handleFrameworkErrorHook(errorModel: unknown): void {
		const detail = (errorModel || {}) as Record<string, unknown>;
		emit("framework-error", detail);
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

	const normalizedToolsConfig = $derived.by(() =>
		normalizeToolsConfig((effectiveTools || {}) as any),
	);
	const annotationToolbarPlacementEnabled = $derived.by(() => {
		const levels: Array<"section" | "item" | "passage"> = [
			"section",
			"item",
			"passage",
		];
		return levels.some((level) =>
			resolveToolsForLevel(normalizedToolsConfig as any, level).includes(
				"annotationToolbar",
			),
		);
	});
	const annotationToolbarProviderEnabled = $derived.by(() =>
		activeToolkitCoordinator?.isToolEnabled?.("annotationToolbar") ??
		((normalizedToolsConfig as any)?.providers?.annotationToolbar?.enabled !==
			false),
	);
	const shouldRenderAnnotationToolbar = $derived(
		Boolean(
			activeToolkitCoordinator &&
				annotationToolbarPlacementEnabled &&
				annotationToolbarProviderEnabled,
		),
	);
	let annotationToolbarModuleLoaded = $state(false);

	$effect(() => {
		if (!shouldRenderAnnotationToolbar) return;
		if (annotationToolbarModuleLoaded) return;
		let cancelled = false;
		void import("@pie-players/pie-tool-annotation-toolbar")
			.then(() => {
				if (!cancelled) {
					annotationToolbarModuleLoaded = true;
				}
			})
			.catch(() => {
				// Keep rendering gated if the optional module is not installed.
				if (!cancelled) {
					annotationToolbarModuleLoaded = false;
				}
			});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.createSectionController =
			effectiveCreateSectionController || (() => new SectionController());
	});

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.frameworkErrorHook = handleFrameworkErrorHook;
		return () => {
			toolkitElement.frameworkErrorHook = undefined;
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
					isPageMode?: boolean;
			  }
			| null;
		const items = compositionModel?.items || [];
		const isPageMode = compositionModel?.isPageMode === true;
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
			canNext: !isPageMode && currentIndex < items.length - 1,
			canPrevious: !isPageMode && currentIndex > 0,
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
	section={resolvedSection}
	section-id={sectionId}
	attempt-id={attemptId}
	player-type={effectivePlayerType}
	player={effectivePlayer}
	env={effectiveEnv}
	lazy-init={effectiveLazyInit}
	tool-config-strictness={effectiveToolConfigStrictness}
	tools={effectiveTools}
	{toolRegistry}
	accessibility={effectiveAccessibility}
	coordinator={effectiveCoordinator}
	frameworkErrorHook={handleFrameworkErrorHook}
	isolation={effectiveIsolation}
	oncomposition-changed={handleCompositionChanged}
	ontoolkit-ready={handleToolkitReadyEvent}
	onsection-ready={handleSectionReadyEvent}
	onruntime-error={handleRuntimeErrorEvent}
	onsession-changed={handleSessionChangedEvent}
	onruntime-owned={handleRuntimeOwnedEvent}
	onruntime-inherited={handleRuntimeInheritedEvent}
>
	{#if shouldRenderAnnotationToolbar && annotationToolbarModuleLoaded}
		<pie-tool-annotation-toolbar
			enabled={true}
			ttsService={activeToolkitCoordinator.ttsService}
			highlightCoordinator={activeToolkitCoordinator.highlightCoordinator}
		></pie-tool-annotation-toolbar>
	{/if}
	<slot></slot>
</pie-assessment-toolkit>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
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
