<svelte:options
	customElement={{
		tag: "pie-section-player-base",
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
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
		currentItemIndex: 0,
		currentItem: null,
		isPageMode: false,
		itemSessionsByItemId: {},
		testAttemptSession: null,
	};

	let {
		assessmentId = "section-demo-direct",
		section = null as AssessmentSection | null,
		sectionId = "",
		attemptId = "",
		view = "candidate",
		playerType = "iife",
		player = null as Record<string, unknown> | null,
		lazyInit = true,
		tools = null as Record<string, unknown> | null,
		accessibility = null as Record<string, unknown> | null,
		coordinator = null as unknown,
		createSectionController = null as unknown,
		isolation = "inherit",
		env = {} as Record<string, unknown>,
	} = $props();

	let toolkitElement = $state<any>(null);
	let lastCompositionSignature = $state("");
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

	function getCompositionSignature(
		model: SectionCompositionModel | null | undefined,
	): string {
		if (!model) return "";
		return JSON.stringify({
			sectionId: model.section?.identifier || "",
			currentItemIndex: model.currentItemIndex ?? -1,
			itemIds: (model.items || []).map((item) => item?.id || ""),
			passageIds: (model.passages || []).map((passage) => passage?.id || ""),
			sessionByItem: Object.entries(model.itemSessionsByItemId || {})
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([itemId, session]) => [itemId, JSON.stringify(session ?? null)]),
		});
	}

	function handleCompositionChanged(event: Event): void {
		const detail = (event as CustomEvent<{ composition?: SectionCompositionModel }>).detail;
		const nextComposition = detail?.composition || EMPTY_COMPOSITION;
		const nextSignature = getCompositionSignature(nextComposition);
		if (nextSignature === lastCompositionSignature) return;
		lastCompositionSignature = nextSignature;
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
			createSectionController || (() => new SectionController());
	});

</script>

<pie-assessment-toolkit
	bind:this={toolkitElement}
	assessment-id={assessmentId}
	section={resolvedSection}
	section-id={sectionId}
	attempt-id={attemptId}
	player-type={playerType}
	{player}
	{view}
	{env}
	lazy-init={lazyInit}
	{tools}
	{accessibility}
	{coordinator}
	create-section-controller={createSectionController}
	{isolation}
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
