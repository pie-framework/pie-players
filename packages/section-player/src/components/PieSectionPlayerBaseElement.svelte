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
			view: { type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			player: { type: "Object", reflect: false },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
			accessibility: { type: "Object", reflect: false },
			coordinator: { type: "Object", reflect: false },
			createSectionController: { type: "Object", reflect: false },
			isolation: { attribute: "isolation", type: "String" },
			env: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import "@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element";
	import {
		createDefaultPersonalNeedsProfile,
	} from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher } from "svelte";
	import { SectionController } from "../controllers/SectionController.js";
	import type { SectionCompositionModel } from "../controllers/types.js";
	import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

	const EMPTY_COMPOSITION: SectionCompositionModel = {
		section: null,
		assessmentItemRefs: [],
		passages: [],
		items: [],
		rubricBlocks: [],
		instructions: [],
		renderables: [],
		currentItemIndex: 0,
		currentItem: null,
		isPageMode: false,
		itemSessionsByItemId: {},
		testAttemptSession: null,
	};
	const DEFAULT_ASSESSMENT_ID = "section-demo-direct";
	const DEFAULT_PLAYER_TYPE = "iife";
	const DEFAULT_LAZY_INIT = true;
	const DEFAULT_ISOLATION = "inherit";
	const LEGACY_RUNTIME_WARNING_KEY = "pie-section-player-base:legacy-runtime-props";
	const warnedKeys = new Set<string>();
	type RuntimeConfig = {
		assessmentId?: string;
		playerType?: string;
		player?: Record<string, unknown> | null;
		lazyInit?: boolean;
		tools?: Record<string, unknown> | null;
		accessibility?: Record<string, unknown> | null;
		coordinator?: unknown;
		createSectionController?: unknown;
		isolation?: string;
		env?: Record<string, unknown>;
	};
	let {
		assessmentId = DEFAULT_ASSESSMENT_ID,
		runtime = null as RuntimeConfig | null,
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		view = "candidate",
		playerType = DEFAULT_PLAYER_TYPE,
		player = null as Record<string, unknown> | null,
		lazyInit = DEFAULT_LAZY_INIT,
		tools = null as Record<string, unknown> | null,
		accessibility = null as Record<string, unknown> | null,
		coordinator = null as unknown,
		createSectionController = null as unknown,
		isolation = DEFAULT_ISOLATION,
		env = null as Record<string, unknown> | null,
	} = $props();

	let toolkitElement = $state<any>(null);
	let lastCompositionVersion = $state(-1);
	type BaseSectionPlayerEvents = {
		"composition-changed": { composition: SectionCompositionModel };
		"toolkit-ready": Record<string, unknown>;
		"section-ready": Record<string, unknown>;
		"runtime-error": Record<string, unknown>;
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
	const effectiveAccessibility = $derived.by(
		() => runtime?.accessibility ?? accessibility,
	);
	const effectiveCoordinator = $derived.by(() => runtime?.coordinator ?? coordinator);
	const effectiveCreateSectionController = $derived.by(
		() => runtime?.createSectionController ?? createSectionController,
	);
	const effectiveIsolation = $derived.by(() => runtime?.isolation ?? isolation);
	const effectiveEnv = $derived.by(() => runtime?.env ?? env ?? {});
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
		emit(eventName, detail || ({} as Record<string, unknown>));
	}

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.createSectionController =
			effectiveCreateSectionController || (() => new SectionController());
	});

	$effect(() => {
		if (typeof window === "undefined" || runtime) return;
		const usedLegacyProps: string[] = [];
		if (assessmentId !== DEFAULT_ASSESSMENT_ID) usedLegacyProps.push("assessmentId");
		if (playerType !== DEFAULT_PLAYER_TYPE) usedLegacyProps.push("playerType");
		if (player !== null) usedLegacyProps.push("player");
		if (lazyInit !== DEFAULT_LAZY_INIT) usedLegacyProps.push("lazyInit");
		if (tools !== null) usedLegacyProps.push("tools");
		if (accessibility !== null) usedLegacyProps.push("accessibility");
		if (coordinator !== null) usedLegacyProps.push("coordinator");
		if (createSectionController !== null) usedLegacyProps.push("createSectionController");
		if (isolation !== DEFAULT_ISOLATION) usedLegacyProps.push("isolation");
		if (env !== null) usedLegacyProps.push("env");
		if (usedLegacyProps.length === 0) return;
		const key = `${LEGACY_RUNTIME_WARNING_KEY}:${usedLegacyProps.sort().join(",")}`;
		if (warnedKeys.has(key)) return;
		warnedKeys.add(key);
		console.warn(
			`[pie-section-player-base] Runtime props (${usedLegacyProps.join(", ")}) are deprecated. Prefer the \`runtime\` object prop.`,
		);
	});

</script>

<pie-assessment-toolkit
	bind:this={toolkitElement}
	assessment-id={effectiveAssessmentId}
	section={resolvedSection}
	section-id={sectionId}
	attempt-id={attemptId}
	player-type={effectivePlayerType}
	player={effectivePlayer}
	{view}
	env={effectiveEnv}
	lazy-init={effectiveLazyInit}
	tools={effectiveTools}
	accessibility={effectiveAccessibility}
	coordinator={effectiveCoordinator}
	isolation={effectiveIsolation}
	oncomposition-changed={handleCompositionChanged}
	ontoolkit-ready={(event: Event) => handleToolkitEvent(event, "toolkit-ready")}
	onsection-ready={(event: Event) => handleToolkitEvent(event, "section-ready")}
	onruntime-error={(event: Event) => handleToolkitEvent(event, "runtime-error")}
	onsession-changed={(event: Event) => handleToolkitEvent(event, "session-changed")}
	onruntime-owned={(event: Event) => handleToolkitEvent(event, "runtime-owned")}
	onruntime-inherited={(event: Event) => handleToolkitEvent(event, "runtime-inherited")}
>
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
