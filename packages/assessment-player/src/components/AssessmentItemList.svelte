<script lang="ts">
	import type { QuestionEntity } from '@pie-framework/pie-players-shared';

	let {
		questions = [] as QuestionEntity[],
		currentIndex = 0,
		onItemSelected,
		onItemRemove,
		onItemAdd,
		onItemMove,
		readOnly = false
	}: {
		questions?: QuestionEntity[];
		currentIndex?: number;
		onItemSelected?: (index: number) => void;
		onItemRemove?: (itemId: string, index: number) => void;
		onItemAdd?: () => void;
		onItemMove?: (fromIndex: number, toIndex: number) => void;
		readOnly?: boolean;
	} = $props();

	let draggedIndex = $state<number | null>(null);

	function handleItemClick(index: number) {
		onItemSelected?.(index);
	}

	function handleRemove(event: Event, itemId: string, index: number) {
		event.stopPropagation();
		onItemRemove?.(itemId, index);
	}

	function handleDragStart(event: DragEvent, index: number) {
		if (readOnly) return;
		draggedIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', index.toString());
		}
	}

	function handleDragOver(event: DragEvent) {
		if (readOnly || draggedIndex === null) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
	}

	function handleDrop(event: DragEvent, targetIndex: number) {
		if (readOnly || draggedIndex === null) return;
		event.preventDefault();

		if (draggedIndex !== targetIndex) {
			onItemMove?.(draggedIndex, targetIndex);
		}
		draggedIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
	}
</script>

<div class="assessment-item-list flex flex-col h-full bg-base-100">
	<div class="p-4 border-b border-base-300">
		<h3 class="font-bold text-lg">Assessment Items</h3>
	</div>

	<div class="flex-1 overflow-y-auto p-2">
		{#each questions as question, i}
			<div
				role="button"
				tabindex="0"
				class="item-card cursor-pointer rounded-lg p-3 mb-2 border transition-all"
				class:border-primary={i === currentIndex}
				class:bg-primary={i === currentIndex}
				class:bg-opacity-10={i === currentIndex}
				class:border-base-300={i !== currentIndex}
				class:hover:bg-base-200={i !== currentIndex}
				draggable={!readOnly}
				ondragstart={(e) => handleDragStart(e, i)}
				ondragover={handleDragOver}
				ondrop={(e) => handleDrop(e, i)}
				ondragend={handleDragEnd}
				onclick={() => handleItemClick(i)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleItemClick(i);
					}
				}}
			>
				<div class="flex items-start justify-between gap-2">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							{#if !readOnly}
								<span class="text-xs opacity-50">⋮⋮</span>
							{/if}
							<span class="font-semibold text-sm">Item {i + 1}</span>
						</div>
						{#if question.title}
							<div class="text-xs opacity-70 truncate mt-1">{question.title}</div>
						{/if}
						{#if question.itemVId}
							<div class="text-xs opacity-50 font-mono truncate mt-1">{question.itemVId}</div>
						{/if}
					</div>
					{#if !readOnly && onItemRemove}
						<button
							class="btn btn-ghost btn-xs"
							onclick={(e) => handleRemove(e, question.id || '', i)}
							title="Remove item"
						>
							✕
						</button>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	{#if !readOnly && onItemAdd}
		<div class="p-4 border-t border-base-300">
			<button class="btn btn-primary btn-sm w-full" onclick={onItemAdd}>+ Add Item</button>
		</div>
	{/if}
</div>

<style>
	.item-card {
		user-select: none;
	}

	.item-card:active {
		cursor: grabbing;
	}
</style>
