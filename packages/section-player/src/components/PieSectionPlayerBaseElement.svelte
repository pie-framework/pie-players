<svelte:options
	customElement={{
		tag: "pie-section-player-base",
		shadow: "open",
		props: {
			runtime: { type: "Object", reflect: false },
			// Presentation flag: controls render <nds-icon-button> only when this
			// is explicitly true; otherwise they use plain <button>s.
			ndsIcons: { attribute: "nds-icons", type: "Boolean" },
			// Interface locale: the language the player renders its own UI in, as a
			// BCP-47 tag. Unset renders `en-US`. Distinct from the authored content
			// language, which travels on `runtime.contentLanguage`.
			locale: { attribute: "locale", type: "String" },
			section: { type: "Object", reflect: false },
			// Transport for the layouts' `session`; the toolkit applies it.
			session: { type: "Object", reflect: false },
			// The assessment entity whose `personalNeedsProfile` and `settings` the
			// toolkit's tool policy reads, forwarded to the coordinator it builds.
			assessment: { type: "Object", reflect: false },
			sectionId: { attribute: "section-id", type: "String" },
			attemptId: { attribute: "attempt-id", type: "String" },
			toolRegistry: { type: "Object", reflect: false },
			toolConfigStrictness: {
				attribute: "tool-config-strictness",
				type: "String",
			},
		},
		extend: coerceBooleanAttributes,
	}}
/>

<script lang="ts">
	import { coerceBooleanAttributes } from "@pie-players/pie-players-shared/ui/attribute-coercion";
	import "@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element";
	import {
		type ToolConfigStrictness,
		type ToolkitCoordinatorApi,
		type ToolRegistry,
	} from "@pie-players/pie-assessment-toolkit";
	import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";
	import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
	import {
		type AssessmentToolkitRuntimeContext,
		connectToolRuntimeContext,
	} from "@pie-players/pie-assessment-toolkit";
	import {
		bindPageLifecycleCommit,
		commitPendingSessions,
		createPieLogger,
	} from "@pie-players/pie-players-shared";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	import { onDestroy, untrack } from "svelte";
	import { SectionController } from "../controllers/SectionController.js";
	import { watchMissingToolProviders } from "./shared/missing-tool-providers.js";
	import { waitForToolkitReady } from "./shared/toolkit-ready-wait.js";
	import type {
		AssessmentEntity,
		AssessmentSection,
		SectionControllerSessionState,
	} from "@pie-players/pie-players-shared/types";
	import { createToolSurfaceHost } from "@pie-players/pie-assessment-toolkit/tools/registration";
	import {
		DEFAULT_ENV,
		DEFAULT_ISOLATION,
		resolveSectionId,
		type RuntimeConfig,
	} from "@pie-players/pie-assessment-toolkit/runtime/engine";

	const logger = createPieLogger("pie-section-player", () => false);

	let {
		runtime = null as RuntimeConfig | null,
		ndsIcons = false,
		locale = "",
		section = null as AssessmentSection | null,
		session = null as SectionControllerSessionState | null,
		assessment = null as AssessmentEntity | null,
		sectionId = "",
		attemptId = "",
		toolRegistry = null as ToolRegistry | null,
		toolConfigStrictness = undefined as ToolConfigStrictness | undefined,
	} = $props();

	let toolkitElement = $state<any>(null);
	let activeToolkitCoordinator = $state<ToolkitCoordinatorApi | null>(null);
	const effectiveAssessmentId = $derived.by(() => runtime?.assessmentId);
	const effectivePlayerType = $derived.by(() => runtime?.playerType);
	const effectivePlayer = $derived.by(() => runtime?.player ?? null);
	const effectiveLazyInit = $derived.by(() => runtime?.lazyInit);
	const effectiveTools = $derived.by(() => runtime?.tools ?? null);
	const effectiveToolContextResolvers = $derived.by(
		() => runtime?.toolContextResolvers ?? null,
	);
	const effectiveToolConfigStrictness = $derived.by(() => {
		const value = toolConfigStrictness;
		return value === "off" || value === "warn" || value === "error"
			? value
			: "error";
	});
	const effectiveAccessibility = $derived.by(
		() => runtime?.accessibility ?? null,
	);
	const effectiveCoordinator = $derived.by(() => runtime?.coordinator ?? null);
	const effectiveCreateSectionController = $derived.by(
		() => runtime?.createSectionController,
	);
	const effectiveIsolation = $derived.by(
		() => runtime?.isolation ?? DEFAULT_ISOLATION,
	);
	const effectiveEnv = $derived.by(() => runtime?.env ?? DEFAULT_ENV);
	// Opt-in — NDS icon buttons render only when explicitly enabled.
	//
	// Resolve to `true` or `undefined` (never `false`): a Svelte custom
	// element serializes `nds-icons={false}` to the attribute string
	// `"false"`, and the toolkit's Boolean prop coerces *any present*
	// attribute — including `"false"` — to `true`. Passing `undefined`
	// removes the attribute so the toolkit falls back to its own `false`
	// default. See PieAssessmentToolkit `ndsIcons`.
	const effectiveNdsIcons = $derived.by(() =>
		ndsIcons === true ? true : undefined,
	);
	// Resolves to a tag or `undefined`, never `""`. A Svelte custom element
	// serializes an unset string prop to an empty attribute, and forwarding that
	// would have the toolkit resolve the empty locale rather than fall back to
	// its `en-US` default.
	const effectiveLocale = $derived.by(() => locale || undefined);
	// Content language, for read-aloud and catalog lookups; runtime-only. A tag or
	// `undefined`, never `""`, for the same reason as the locale above.
	const effectiveContentLanguage = $derived.by(
		() => runtime?.contentLanguage || undefined,
	);
	// Interface locale for the section-overlay surfaces this element mounts.
	//
	// Resolved from the toolkit's runtime context rather than from a second
	// provider: `overlayAnchor` sits inside `<pie-assessment-toolkit>` precisely so
	// context requests from a mounted element bubble to it, and the same is true of
	// a request made on the anchor itself. One provider serves the page.
	let surfaceRuntimeContext = $state<AssessmentToolkitRuntimeContext | null>(
		null,
	);
	// Unconditional: the facade wraps the English-only default before the anchor's
	// context request resolves, so a surface never sees an absent provider.
	const interfaceI18nForSurfaces = $derived(
		resolveInterfaceI18n(surfaceRuntimeContext),
	);
	$effect(() => {
		const anchor = overlayAnchor;
		if (!anchor) return;
		return connectToolRuntimeContext(anchor, (value) => {
			surfaceRuntimeContext = value;
		});
	});
	const defaultToolRegistry = createPackagedToolRegistry();
	const effectiveToolRegistry = $derived(toolRegistry ?? defaultToolRegistry);
	const effectiveOnFrameworkError = $derived.by(() => runtime?.onFrameworkError);
	const effectiveSectionId = $derived(
		resolveSectionId({ sectionId, section, assessmentId: effectiveAssessmentId }),
	);

	// Tool policy reads the profile from the assessment entity only, so a profile
	// a host puts on the section changes no decision.
	let reportedSectionProfile = false;
	$effect(() => {
		const profile = (section as { personalNeedsProfile?: unknown } | null)
			?.personalNeedsProfile;
		if (reportedSectionProfile || !profile) return;
		reportedSectionProfile = true;
		console.warn(
			"[pie-section-player] section.personalNeedsProfile is not read: tool policy reads the profile from the assessment entity. Set this element's `assessment` property to an assessment carrying it, or call updateAssessment(...) on a coordinator you pass. Reported once per element.",
		);
	});

	// The toolkit's events bubble out of this element on their own, which is
	// the one channel they reach the layout host and `document` by. This element
	// reads `toolkit-ready` for the coordinator and re-dispatches nothing:
	// a re-dispatch reaches every listener on this element a second time,
	// because a Svelte custom element's `addEventListener` also subscribes to
	// its component events.
	function toolkitReadyCoordinator(event: Event): ToolkitCoordinatorApi | null {
		const coordinator = (event as CustomEvent<{ coordinator?: unknown }>).detail
			?.coordinator;
		return coordinator ? (coordinator as ToolkitCoordinatorApi) : null;
	}

	function handleToolkitReadyEvent(event: Event): void {
		const coordinator = toolkitReadyCoordinator(event);
		if (coordinator) {
			activeToolkitCoordinator = coordinator;
		}
	}

	// A coordinator the host constructs with its own registry registers tool
	// providers from it, so a tool this player's toolbars render can have none
	// behind it. One constructed without a registry adopts `effectiveToolRegistry`
	// through the toolkit, and the player's own coordinator is built from it.
	$effect(() => {
		const coordinator = activeToolkitCoordinator;
		const registry = effectiveToolRegistry;
		if (!coordinator || coordinator !== effectiveCoordinator) return;
		return untrack(() => watchMissingToolProviders(coordinator, registry));
	});

	/**
	 * The section-scoped surface this CE offers. Capabilities opt in by listing it
	 * in their registration's `surfaces`, so nothing here names one — the
	 * annotation toolbar used to be named in three places in this file, which is
	 * why a host could not contribute a second section-scoped capability without
	 * a PR against this repo.
	 */
	const SECTION_OVERLAY_SURFACE = "section-overlay";
	let overlayAnchor = $state<HTMLDivElement | null>(null);
	const overlaySurfaceHost = createToolSurfaceHost(() => undefined, {
		hostLabel: "pie-section-player"
	});

	$effect(() => {
		const coordinator = activeToolkitCoordinator;
		// Reading the provider here is what re-mounts the surfaces when the locale
		// moves or a catalog lands: the toolkit republishes its context, the
		// derived provider changes identity, and a region label resolved before the
		// catalog arrived is not the one the learner keeps.
		void interfaceI18nForSurfaces;
		overlaySurfaceHost.update({
			anchor: overlayAnchor,
			surface: SECTION_OVERLAY_SURFACE,
			registry: effectiveToolRegistry,
			services: {
				toolkitCoordinator: coordinator,
				ttsService: coordinator?.ttsService ?? null,
				catalogResolver: coordinator?.catalogResolver ?? null,
				i18n: interfaceI18nForSurfaces,
			},
			scope: {
				kind: "section",
				assessmentId: effectiveAssessmentId || coordinator?.assessmentId || "",
				sectionId: effectiveSectionId,
			},
		});
	});

	onDestroy(() => overlaySurfaceHost.destroy());

	// Every controller this player drives commits pending element sessions at the
	// boundaries it owns — item navigation, a same-section input update, a
	// persist. The controller stays DOM-free, so the root comes from here. A
	// section swap is the toolkit's to commit: it does so before the coordinator
	// moves the host's subscriptions off the outgoing controller.
	//
	// Overriding the factory alone reaches only controllers built after this
	// effect runs, and the toolkit has usually built the first section's
	// controller by then: registering on that one as well is what makes the
	// first section's navigation commit at all.
	$effect(() => {
		if (!toolkitElement) return;
		const root = toolkitElement;
		// `runtime.createSectionController` is `unknown` on the runtime config, so
		// the host's factory is narrowed here instead of being passed straight
		// through to the toolkit's loosely typed property.
		const hostFactory = effectiveCreateSectionController;
		const factory: () => unknown =
			typeof hostFactory === "function"
				? (hostFactory as () => unknown)
				: () => new SectionController();
		const register = (controller: unknown) => {
			(
				controller as {
					setPendingSessionCommit?: (fn: (() => void) | null) => void;
				} | null
			)?.setPendingSessionCommit?.(() =>
				commitPendingSessions(root, { reason: "navigate", logger }),
			);
		};
		const installedFactory = () => {
			const controller = factory();
			register(controller);
			return controller;
		};
		// Untracked: an effect that reads the prop it writes invalidates itself.
		const previousFactory = untrack(() => root.createSectionController);
		root.createSectionController = installedFactory;

		// The controller the toolkit has already built, if any, and otherwise
		// the one it has once it emits `toolkit-ready`, which follows the
		// section's controller resolving.
		register(resolveSectionController());
		const onToolkitReady = (event: Event) => {
			register(resolveSectionController(toolkitReadyCoordinator(event)));
		};
		root.addEventListener("toolkit-ready", onToolkitReady);

		// This effect reads the section, attempt and coordinator, so it re-runs on
		// a section swap or a cohort flip. A listener left attached across that
		// would register a commit closure over the previous root onto the next
		// controller, and one outliving the component would sweep a detached
		// subtree.
		return () => {
			root.removeEventListener("toolkit-ready", onToolkitReady);
			if (untrack(() => root.createSectionController) === installedFactory) {
				root.createSectionController = previousFactory;
			}
		};
	});

	// The page going away removes nothing from the DOM, so no teardown seam fires.
	$effect(() => {
		if (typeof window === "undefined") return;
		const root = toolkitElement;
		if (!root) return;
		return bindPageLifecycleCommit({ root: () => root, logger });
	});

	// Svelte 5 compiles `<custom-element onCamelCase={fn}>` as
	// `addEventListener('camelcase', fn)` rather than a property
	// assignment, so the canonical model-shape `onFrameworkError`
	// callback prop on the toolkit cannot be wired through template
	// binding. Imperatively assign it here so `runtime.onFrameworkError`
	// reaches the toolkit's bus subscriber.
	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.onFrameworkError = effectiveOnFrameworkError;
		return () => {
			toolkitElement.onFrameworkError = undefined;
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

	function resolveSectionController(
		readyCoordinator: ToolkitCoordinatorApi | null = null,
	): SectionControllerHandle | null {
		const resolvedAttemptId = attemptId || undefined;
		const coordinator =
			readyCoordinator ||
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
				sectionId: effectiveSectionId,
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
		if (!(timeoutMs > 0)) return null;
		return (
			resolveSectionController() ??
			waitForToolkitReady(
				toolkitElement as EventTarget | null,
				(event) =>
					resolveSectionController(event ? toolkitReadyCoordinator(event) : null),
				timeoutMs,
			)
		);
	}

</script>

<pie-assessment-toolkit
	bind:this={toolkitElement}
	assessment-id={effectiveAssessmentId}
	section={section}
	session={session}
	assessment={assessment}
	section-id={sectionId}
	attempt-id={attemptId}
	player-type={effectivePlayerType}
	player={effectivePlayer}
	env={effectiveEnv}
	nds-icons={effectiveNdsIcons}
	locale={effectiveLocale}
	content-language={effectiveContentLanguage}
	lazy-init={effectiveLazyInit}
	tool-config-strictness={effectiveToolConfigStrictness}
	tools={effectiveTools}
	toolContextResolvers={effectiveToolContextResolvers}
	toolRegistry={effectiveToolRegistry}
	accessibility={effectiveAccessibility}
	coordinator={effectiveCoordinator}
	isolation={effectiveIsolation}
	ontoolkit-ready={handleToolkitReadyEvent}
>
	<!-- Mount point for section-scoped surface capabilities. Always present so a
	     capability granted mid-session has somewhere to land, and inside
	     <pie-assessment-toolkit> so the toolkit's context requests still bubble to
	     it from a mounted element. -->
	<div
		bind:this={overlayAnchor}
		class="pie-section-player-surface-anchor"
		data-pie-tool-surface={SECTION_OVERLAY_SURFACE}
	></div>
	<slot></slot>
</pie-assessment-toolkit>

<style>
	:host {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	/* Layout-transparent: the anchor is always present, and a permanent flex item
	   would shift `gap` and child-index selectors in the column below it whether or
	   not any capability is mounted. */
	.pie-section-player-surface-anchor {
		display: contents;
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
