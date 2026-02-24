<script lang="ts">
	import type { ItemEntity, PassageEntity } from "@pie-players/pie-players-shared";

	export type QtiContentKind =
		| "assessment-item"
		| "rubric-block-stimulus"
		| "rubric-block-instructions"
		| "rubric-block-rubric";

	let {
		item,
		contentKind = "assessment-item" as QtiContentKind,
		assessmentId = "",
		sectionId = "",
		customClassName = "",
	}: {
		item: ItemEntity | PassageEntity;
		contentKind?: QtiContentKind;
		assessmentId?: string;
		sectionId?: string;
		customClassName?: string;
	} = $props();
</script>

<div
	class="pie-section-player__item-renderer {customClassName}"
	data-assessment-id={assessmentId}
	data-section-id={sectionId}
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
