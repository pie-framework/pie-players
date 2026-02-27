<svelte:options
	customElement={{
		tag: "pie-section-player-base",
		shadow: "open",
		props: {
			assessmentId: { attribute: "assessment-id", type: "String" },
			section: { type: "Object", reflect: false },
			view: { type: "String" },
			playerType: { attribute: "player-type", type: "String" },
			lazyInit: { attribute: "lazy-init", type: "Boolean" },
			tools: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import {
		createDefaultPersonalNeedsProfile,
	} from "@pie-players/pie-assessment-toolkit";
	import { createEventDispatcher, onMount } from "svelte";
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
		view = "candidate",
		playerType = "iife",
		lazyInit = true,
		tools = null as Record<string, unknown> | null,
	} = $props();

	let toolkitElement = $state<any>(null);
	let lastCompositionSignature = $state("");
	const dispatch = createEventDispatcher<{
		"composition-changed": { composition: SectionCompositionModel };
	}>();
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

	function emit(name: string, detail: unknown): void {
		dispatch(name as "composition-changed", detail as { composition: SectionCompositionModel });
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
			sessionKeys: Object.keys(model.itemSessionsByItemId || {}).sort(),
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

	$effect(() => {
		if (!toolkitElement) return;
		toolkitElement.createSectionController = () => new SectionController();
	});

	onMount(async () => {
		const imports: Promise<unknown>[] = [];
		if (!customElements.get("pie-assessment-toolkit")) {
			imports.push(
				import(
					"@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element"
				),
			);
		}
		await Promise.all(imports);
	});
</script>

<pie-assessment-toolkit
	bind:this={toolkitElement}
	assessment-id={assessmentId}
	section={resolvedSection}
	player-type={playerType}
	{view}
	lazy-init={lazyInit}
	{tools}
	oncomposition-changed={handleCompositionChanged}
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
