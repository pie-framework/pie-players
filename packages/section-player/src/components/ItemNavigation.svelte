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

<div class="item-navigation">
	<button
		type="button"
		class="nav-button nav-previous"
		disabled={!canPrevious}
		onclick={onprevious}
	>
		Previous
	</button>
	<span class="item-counter">
		{currentIndex + 1} / {totalItems}
	</span>
	<button
		type="button"
		class="nav-button nav-next"
		disabled={!canNext}
		onclick={onnext}
	>
		Next
	</button>
</div>

<style>
	.item-navigation {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: #f9f9f9;
		border-top: 1px solid #e0e0e0;
		gap: 1rem;
	}

	.nav-button {
		padding: 0.5rem 1rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
		min-width: 100px;
	}

	.nav-button:hover:not(:disabled) {
		background: #0056b3;
	}

	.nav-button:disabled {
		background: #ccc;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.item-counter {
		font-size: 0.9rem;
		color: #666;
		font-weight: 500;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.item-navigation {
			flex-direction: column;
		}

		.nav-button {
			width: 100%;
		}
	}
</style>
