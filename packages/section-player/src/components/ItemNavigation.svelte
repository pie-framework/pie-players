<!--
  ItemNavigation - Internal Component

  Navigation controls for item mode (keepTogether: false).
  Not exposed as a web component - used internally in PieSectionPlayer.
-->
<script lang="ts">
	let {
		currentIndex,
		totalItems,
		canNext,
		canPrevious,
		onprevious,
		onnext
	}: {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		onprevious?: () => void;
		onnext?: () => void;
	} = $props();
</script>

<div class="pie-section-player__item-navigation">
	<button
		type="button"
		class="pie-section-player__nav-button pie-section-player__nav-button--previous"
		disabled={!canPrevious}
		onclick={onprevious}
	>
		Previous
	</button>
	<span class="pie-section-player__item-counter">
		{currentIndex + 1} / {totalItems}
	</span>
	<button
		type="button"
		class="pie-section-player__nav-button pie-section-player__nav-button--next"
		disabled={!canNext}
		onclick={onnext}
	>
		Next
	</button>
</div>

<style>
	.pie-section-player__item-navigation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: var(--pie-secondary-background, #f9f9f9);
		border-top: 1px solid var(--pie-border-light, #e0e0e0);
		gap: 1rem;
	}

	.pie-section-player__nav-button {
		padding: 0.5rem 1rem;
		background: var(--pie-primary, #007bff);
		color: var(--pie-white, white);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
		min-width: 100px;
	}

	.pie-section-player__nav-button:hover:not(:disabled) {
		background: var(--pie-primary-dark, #0056b3);
	}

	.pie-section-player__nav-button:disabled {
		background: var(--pie-disabled-secondary, #ccc);
		cursor: not-allowed;
		opacity: 0.6;
	}

	.pie-section-player__item-counter {
		font-size: 0.9rem;
		color: var(--pie-disabled, #666);
		font-weight: 500;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.pie-section-player__item-navigation {
			flex-direction: column;
		}

		.pie-section-player__nav-button {
			width: 100%;
		}
	}
</style>
