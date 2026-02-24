<script lang="ts">
	import type { ComponentDefinition } from "../../component-definitions.js";
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";
	import ItemRenderer from "../ItemRenderer.svelte";
	import SplitPanelPrimitive from "./SplitPanelPrimitive.svelte";

	let {
		passages,
		items,
		itemSessions = {},
		player = "",
		env = { mode: "gather", role: "student" },
		playerVersion = "latest",
		assessmentId = "",
		sectionId = "",
		toolkitCoordinator = null,
		playerDefinitions = {} as Partial<Record<string, ComponentDefinition>>,
		onsessionchanged,
	}: {
		passages: PassageEntity[];
		items: ItemEntity[];
		itemSessions?: Record<string, any>;
		player?: string;
		env?: { mode: "gather" | "view" | "evaluate" | "author"; role: "student" | "instructor" };
		playerVersion?: string;
		assessmentId?: string;
		sectionId?: string;
		toolkitCoordinator?: any;
		playerDefinitions?: Partial<Record<string, ComponentDefinition>>;
		onsessionchanged?: (itemId: string, session: any) => void;
	} = $props();

	function handleItemSessionChanged(itemId: string) {
		return (event: CustomEvent) => {
			onsessionchanged?.(itemId, event.detail);
		};
	}

	let passagesScrolling = $state(false);
	let itemsScrolling = $state(false);
	let passagesScrollTimer: ReturnType<typeof setTimeout> | null = null;
	let itemsScrollTimer: ReturnType<typeof setTimeout> | null = null;
	let hasPassages = $derived(passages.length > 0);

	function markScrolling(target: "passages" | "items") {
		if (target === "passages") {
			passagesScrolling = true;
			if (passagesScrollTimer) clearTimeout(passagesScrollTimer);
			passagesScrollTimer = setTimeout(() => {
				passagesScrolling = false;
			}, 700);
			return;
		}
		itemsScrolling = true;
		if (itemsScrollTimer) clearTimeout(itemsScrollTimer);
		itemsScrollTimer = setTimeout(() => {
			itemsScrolling = false;
		}, 700);
	}
</script>

<div class="pie-section-player__composed-split-panel-layout">
	<SplitPanelPrimitive hasLeft={hasPassages} leftPane={hasPassages ? leftPane : undefined} {rightPane} />
</div>

{#snippet leftPane()}
	<aside
		class={`pie-section-player__passages-panel ${passagesScrolling ? "pie-section-player__panel--scrolling" : ""}`}
		aria-label="Reading passages"
		onscroll={() => markScrolling("passages")}
	>
		{#each passages as passage (passage.id)}
			<div class="pie-section-player__passage-wrapper">
				<ItemRenderer
					item={passage}
					{player}
					contentKind="rubric-block-stimulus"
					env={{ mode: "view", role: env.role }}
					{assessmentId}
					{sectionId}
					{toolkitCoordinator}
					{playerDefinitions}
					customClassName="pie-section-player__passage-item"
				/>
			</div>
		{/each}
	</aside>
{/snippet}

{#snippet rightPane()}
	<main
		class={`pie-section-player__items-panel ${itemsScrolling ? "pie-section-player__panel--scrolling" : ""}`}
		aria-label="Assessment items"
		onscroll={() => markScrolling("items")}
	>
		{#each items as item, index (item.id || index)}
			<div class="pie-section-player__item-wrapper" data-item-index={index}>
				<ItemRenderer
					{item}
					{player}
					contentKind="assessment-item"
					{env}
					session={itemSessions[item.id || ""]}
					{playerVersion}
					{assessmentId}
					{sectionId}
					{toolkitCoordinator}
					{playerDefinitions}
					onsessionchanged={handleItemSessionChanged(item.id || "")}
					customClassName="pie-section-player__item-content"
				/>
			</div>
		{/each}
	</main>
{/snippet}

<style>
	.pie-section-player__composed-split-panel-layout {
		display: block;
		height: 100%;
		max-height: 100%;
		min-height: 0;
		padding: 1rem;
	}

	.pie-section-player__passages-panel,
	.pie-section-player__items-panel {
		height: 100%;
		max-height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		overscroll-behavior: contain;
		min-height: 0;
		min-width: 0;
		scrollbar-width: auto;
		scrollbar-color: transparent transparent;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.pie-section-player__panel--scrolling {
		scrollbar-color: var(--pie-blue-grey-300, #c1c1c1) var(--pie-secondary-background, #f1f1f1);
	}

	.pie-section-player__item-wrapper,
	.pie-section-player__passage-wrapper {
		padding: 0.25rem;
		background: var(--pie-white, white);
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 6px;
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.pie-section-player__composed-split-panel-layout {
			padding: 0.5rem;
		}
		.pie-section-player__passages-panel,
		.pie-section-player__items-panel {
			height: auto;
			max-height: none;
			overflow-y: visible;
			gap: 1rem;
		}
	}

	.pie-section-player__passages-panel::-webkit-scrollbar,
	.pie-section-player__items-panel::-webkit-scrollbar {
		width: 0px;
		background: transparent;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar {
		width: 8px;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar-track {
		background: var(--pie-secondary-background, #f1f1f1);
		border-radius: 4px;
	}

	.pie-section-player__panel--scrolling::-webkit-scrollbar-thumb {
		background: var(--pie-blue-grey-300, #c1c1c1);
		border-radius: 4px;
	}
</style>
