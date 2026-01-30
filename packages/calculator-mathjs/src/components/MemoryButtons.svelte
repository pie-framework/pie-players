<script lang="ts">
	/**
	 * Memory function buttons component
	 * Handles MC, MR, M+, M- operations
	 */
	interface Props {
		memoryValue: number;
		onMemoryClear: () => void;
		onMemoryRecall: () => void;
		onMemoryAdd: () => void;
		onMemorySubtract: () => void;
	}

	let {
		memoryValue = 0,
		onMemoryClear,
		onMemoryRecall,
		onMemoryAdd,
		onMemorySubtract
	}: Props = $props();

	const memoryEmpty = $derived(memoryValue === 0);
	const memoryLabel = $derived(
		memoryEmpty ? 'Memory recall' : `Memory recall. Memory contains ${memoryValue}`
	);
</script>

<div role="group" aria-label="Memory functions" class="flex gap-2 mb-4">
	<button class="btn btn-sm flex-1 btn-ghost" onclick={onMemoryClear} aria-label="Memory clear">
		MC
	</button>
	<button
		class="btn btn-sm flex-1 btn-ghost"
		onclick={onMemoryRecall}
		aria-label={memoryLabel}
		aria-disabled={memoryEmpty}
		disabled={memoryEmpty}
	>
		MR
	</button>
	<button class="btn btn-sm flex-1 btn-ghost" onclick={onMemoryAdd} aria-label="Memory add">
		M+
	</button>
	<button
		class="btn btn-sm flex-1 btn-ghost"
		onclick={onMemorySubtract}
		aria-label="Memory subtract"
	>
		M-
	</button>
</div>
