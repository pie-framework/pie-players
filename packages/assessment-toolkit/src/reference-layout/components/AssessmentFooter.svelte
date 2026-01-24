<script lang="ts">
	import type { AssessmentPlayer } from '../../player/AssessmentPlayer';

	let {
		player,
		currentQuestion,
		totalQuestions,
		canNext,
		canPrevious
	}: {
		player: AssessmentPlayer;
		currentQuestion: number;
		totalQuestions: number;
		canNext: boolean;
		canPrevious: boolean;
	} = $props();

	function handlePrevious() {
		player.navigatePrevious();
	}

	function handleNext() {
		player.navigateNext();
	}
</script>

<footer class="assessment-footer">
	<!-- Question Counter and Navigation -->
	<div class="footer-content">
		<span class="question-counter">Question {currentQuestion} of {totalQuestions}</span>
		<div class="navigation-buttons">
			<button class="nav-button" onclick={handlePrevious} disabled={!canPrevious}>
				← Back
			</button>
			<button class="nav-button" onclick={handleNext} disabled={!canNext}>
				Next →
			</button>
		</div>
	</div>
</footer>

<style>
	.assessment-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.75rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border-top: 1px solid var(--pie-border, #e0e0e0);
		min-height: 56px;
	}

	.footer-content {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.question-counter {
		font-size: 0.875rem;
		color: var(--pie-text, #000);
		font-weight: 500;
	}

	.navigation-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.nav-button {
		padding: 0.5rem 1rem;
		background-color: var(--pie-background, #ffffff);
		border: 1px solid var(--pie-border, #e0e0e0);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.875rem;
		color: var(--pie-text, #000);
	}

	.nav-button:hover:not(:disabled) {
		background-color: var(--pie-secondary-background, #f5f5f5);
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>

