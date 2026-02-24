<script lang="ts">
	import {
		assessmentToolkitRuntimeContext,
		type AssessmentToolkitRuntimeContext,
	} from "@pie-players/pie-assessment-toolkit";
	import { ContextConsumer } from "@pie-players/pie-context";
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";

	export type QtiContentKind =
		| "assessment-item"
		| "rubric-block-stimulus"
		| "rubric-block-instructions"
		| "rubric-block-rubric";

	let {
		item,
		contentKind = "assessment-item" as QtiContentKind,
		customClassName = "",
	}: {
		item: ItemEntity | PassageEntity;
		contentKind?: QtiContentKind;
		customClassName?: string;
	} = $props();

	let contextHostElement = $state<HTMLElement | null>(null);
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let runtimeContextConsumer: ContextConsumer<
		typeof assessmentToolkitRuntimeContext
	> | null = null;

	const effectiveAssessmentId = $derived(runtimeContext?.assessmentId ?? "");
	const effectiveSectionId = $derived(runtimeContext?.sectionId ?? "");

	$effect(() => {
		if (!contextHostElement) return;
		runtimeContextConsumer = new ContextConsumer(contextHostElement, {
			context: assessmentToolkitRuntimeContext,
			subscribe: true,
			onValue: (value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		});
		runtimeContextConsumer.connect();
		return () => {
			runtimeContextConsumer?.disconnect();
			runtimeContextConsumer = null;
		};
	});
</script>

<div
	bind:this={contextHostElement}
	class="pie-section-player__item-renderer {customClassName}"
	data-assessment-id={effectiveAssessmentId}
	data-section-id={effectiveSectionId}
	data-item-id={item.id}
	data-content-kind={contentKind}
>
	<div class="pie-section-player__item-header">
		<h4 class="pie-section-player__item-title">{item.name || "Question"}</h4>
		<slot name="toolbar"></slot>
	</div>
	<slot></slot>
</div>

<style>
	.pie-section-player__item-renderer {
		display: block;
		margin-bottom: 0;
	}

	.pie-section-player__item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0;
		margin-bottom: 0.5rem;
	}

	.pie-section-player__item-title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: var(--pie-primary, #1976d2);
	}
</style>
