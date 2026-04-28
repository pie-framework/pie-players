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
			env: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element";
	import {
		createDefaultPersonalNeedsProfile,
		type FrameworkErrorModel,
		type ToolConfigStrictness,
		type ToolkitCoordinatorApi,
		type ToolRegistry,
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
		resolveOnFrameworkError,
		type RuntimeConfig,
		type StageChangeHandler,
	} from "@pie-players/pie-assessment-toolkit/runtime/internal";
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
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
		onFrameworkError = undefined as
			| undefined
			| ((model: FrameworkErrorModel) => void),
		onStageChange = undefined as StageChangeHandler | undefined,
		env = null as Record<string, unknown> | null,
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
	const effectivePlayerType = $derived.by(() => runtime?.playerType ?? playerType);
	const effectivePlayer = $derived.by(() => runtime?.player ?? player);
	const effectiveLazyInit = $derived.by(() => runtime?.lazyInit ?? lazyInit);
	const effectiveTools = $derived.by(() => runtime?.tools ?? tools);
	const effectiveToolConfigStrictness = $derived.by(() => {
		const value = runtime?.toolConfigStrictness ?? toolConfigStrictness;
		return value === "off" || value === "warn" || value === "error"
			? value
			: "error";
	});
	const effectiveAccessibility = $derived.by(
		() => runtime?.accessibility ?? accessibility,
	);
	const effectiveCoordinator = $derived.by(() => runtime?.coordinator ?? coordinator);
	const effectiveCreateSectionController = $derived.by(
		() => runtime?.createSectionController,
	);
	const effectiveIsolation = $derived.by(
		() => runtime?.isolation ?? DEFAULT_ISOLATION,
	);
	const effectiveEnv = $derived.by(() => runtime?.env ?? env ?? DEFAULT_ENV);
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

	// M8 PR 3 — annotation-toolbar visibility goes through the
	// coordinator's `ToolPolicyEngine`. The engine already applies
	// placement + `policy.allowed` / `policy.blocked` + provider
	// veto + QTI gates in one pass, so the base CE no longer
	// duplicates those checks against the raw `tools` config.
	//
	// The engine answer can change without the coordinator reference
	// changing (e.g. host calls `updateAssessment(...)` mid-session),
	// so we bump `policyVersion` from `onPolicyChange` to retrigger
	// this derivation.
	let policyVersion = $state(0);
	$effect(() => {
		const coord = activeToolkitCoordinator;
		if (!coord || typeof coord.onPolicyChange !== "function") return;
		const unsubscribe = coord.onPolicyChange(() => {
			policyVersion += 1;
		});
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// detach errors are non-fatal
			}
		};
	});
	// Keep the scope shape aligned with what `pie-item-toolbar`
	// passes for its own per-item decisions so a custom
	// `PolicySource` that reads e.g. `assessmentId` cannot disagree
	// with the toolbar's verdict for the same level / id. Item +
	// passage scopes here only know the section we're mounting in
	// (item / passage ids belong to the inner toolbars), so we pass
	// the section id as the scope id and let `assessmentId` /
	// `sectionId` carry the rest.
	//
	// `Array.some` short-circuits on the first matching level, so
	// the typical case (annotation toolbar registered at one level)
	// is one engine call; the worst case is three.
	const ANNOTATION_LEVELS = ["section", "item", "passage"] as const;
	const shouldRenderAnnotationToolbar = $derived.by(() => {
		void policyVersion;
		const coord = activeToolkitCoordinator;
		if (!coord || typeof coord.decideToolPolicy !== "function") return false;
		const scopeId = effectiveSectionId || "*";
		return ANNOTATION_LEVELS.some((level) =>
			coord
				.decideToolPolicy({
					level,
					scope: {
						level,
						scopeId,
						assessmentId: effectiveAssessmentId,
						sectionId: effectiveSectionId || undefined,
					},
				})
				.visibleTools.some((entry) => entry.toolId === "annotationToolbar"),
		);
	});
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

	/**
	 * Host-triggered focus escape hatch for Skip-to-Main. Focuses the passage
	 * card when present, otherwise the first item card. Exposed on the base
	 * element for API parity with the layout custom elements; hosts should
	 * normally prefer calling `focusStart()` on the chosen layout element
	 * (splitpane/vertical/tabbed/kernel-host).
	 */
	export function focusStart(): boolean {
		if (typeof document === "undefined") return false;
		const root = toolkitElement?.closest?.("pie-section-player-base") ||
			toolkitElement ||
			document;
		const passage = (root as ParentNode).querySelector?.(
			"pie-section-player-passage-card",
		) as HTMLElement | null;
		if (passage) {
			passage.scrollIntoView({ block: "start", inline: "nearest" });
			passage.focus();
			return true;
		}
		const itemsPane = (root as ParentNode).querySelector?.(
			"pie-section-player-items-pane",
		);
		const firstItem =
			(itemsPane as ParentNode | null)?.querySelector?.(
				"pie-section-player-item-card",
			) ||
			(root as ParentNode).querySelector?.("pie-section-player-item-card");
		if (firstItem instanceof HTMLElement) {
			firstItem.scrollIntoView({ block: "start", inline: "nearest" });
			firstItem.focus();
			return true;
		}
		return false;
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
	isolation={effectiveIsolation}
	oncomposition-changed={handleCompositionChanged}
	ontoolkit-ready={handleToolkitReadyEvent}
	onsection-ready={handleSectionReadyEvent}
	onframework-error={handleFrameworkErrorEvent}
	onsession-changed={handleSessionChangedEvent}
	onruntime-owned={handleRuntimeOwnedEvent}
	onruntime-inherited={handleRuntimeInheritedEvent}
>
	{#if shouldRenderAnnotationToolbar && annotationToolbarModuleLoaded && activeToolkitCoordinator}
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
