<script lang="ts">
	
	import type { QuestionRef } from '../../player/qti-navigation';
	import type { AssessmentPlayer } from '../../player/AssessmentPlayer';

	let {
		player,
		currentIndex,
		totalItems
	}: {
		player: AssessmentPlayer;
		currentIndex: number;
		totalItems: number;
	} = $props();

	function handleQuestionClick(index: number) {
		player.navigate(index);
	}

	function isQuestionActive(index: number) {
		return index === currentIndex;
	}

	const questionRefs = $derived.by<QuestionRef[]>(() => {
		// best-effort: not all player implementations expose this, but our default does.
		return (player as any)?.getQuestionRefs?.() ?? [];
	});

	// Simple “SchoolCity-ish” grouping: groups of 5 (1-5, 6-10, ...)
	const groups = $derived.by(() => {
		const n = totalItems ?? questionRefs.length ?? 0;
		const size = 5;
		const out: Array<{ start: number; end: number; label: string }> = [];
		for (let i = 0; i < n; i += size) {
			const start = i + 1;
			const end = Math.min(n, i + size);
			out.push({ start, end, label: start === end ? `${start}` : `${start}-${end}` });
		}
		return out;
	});
</script>

<nav class="assessment-navigation">
	<div class="navigation-content">
		<!-- Dropdown (placeholder; sections can be layered in later) -->
		<select
			class="question-select"
			onchange={(e) => {
				const v = Number.parseInt((e.target as HTMLSelectElement).value, 10);
				if (Number.isFinite(v)) handleQuestionClick(v);
			}}
			aria-label="All questions"
		>
			<option value={currentIndex}>All Questions</option>
			{#each Array.from({ length: totalItems }) as _, i (i)}
				<option value={i}>Question {i + 1}</option>
			{/each}
		</select>

		<!-- Range buttons -->
		<div class="range-buttons" aria-label="Question ranges">
			{#each groups as g (g.label)}
				<button
					class="range-button"
					class:active={currentIndex + 1 >= g.start && currentIndex + 1 <= g.end}
					onclick={() => handleQuestionClick(g.start - 1)}
					aria-label="Navigate to questions {g.label}"
				>
					{g.label}
				</button>
			{/each}
		</div>
	</div>
</nav>

<style>
	.assessment-navigation {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		padding: 0.5rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border-bottom: 1px solid var(--pie-border, #e0e0e0);
		gap: 0.5rem;
	}

	.navigation-content {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.75rem;
		align-items: center;
		width: 100%;
	}

	.question-select {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		background: var(--pie-background, #fff);
		font-size: 0.875rem;
	}

	.range-buttons {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		flex: 1;
	}

	.range-button {
		padding: 0.5rem 0.75rem;
		background-color: var(--pie-background, #ffffff);
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #000);
		white-space: nowrap;
		min-width: 56px;
		text-align: center;
	}

	.range-button:hover {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.range-button.active {
		background-color: var(--pie-primary, #3f51b5);
		color: white;
		border-color: var(--pie-primary, #3f51b5);
	}
</style>

