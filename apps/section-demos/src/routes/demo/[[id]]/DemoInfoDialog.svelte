<script lang="ts">
	interface Props {
		open: boolean;
		demoName: string;
		description?: string;
		focus?: string;
		whatMakesItTick?: string[];
		onClose: () => void;
	}

	let {
		open,
		demoName,
		description = "",
		focus = "",
		whatMakesItTick = [],
		onClose
	}: Props = $props();

	let closeButton = $state<HTMLButtonElement | null>(null);

	let resolvedFocus = $derived(
		focus.trim() || description.trim() || "This demo highlights key section player behavior."
	);
	let resolvedTickList = $derived(
		Array.isArray(whatMakesItTick)
			? whatMakesItTick.filter((entry) => typeof entry === "string" && entry.trim().length > 0)
			: []
	);

	$effect(() => {
		if (!open) return;
		queueMicrotask(() => closeButton?.focus());
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener("keydown", handleKeydown);
		return () => {
			window.removeEventListener("keydown", handleKeydown);
		};
	});
</script>

{#if open}
	<div class="pie-demo-info-dialog" role="presentation">
		<button
			type="button"
			class="pie-demo-info-dialog__backdrop"
			aria-label="Close demo info dialog"
			onclick={onClose}
		></button>
		<div
			class="pie-demo-info-dialog__panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="pie-demo-info-dialog-title"
			aria-describedby="pie-demo-info-dialog-focus"
		>
			<header class="pie-demo-info-dialog__header">
				<h2 id="pie-demo-info-dialog-title" class="pie-demo-info-dialog__title">{demoName}</h2>
				<button
					type="button"
					class="pie-demo-info-dialog__close-button"
					onclick={onClose}
					aria-label="Close demo info dialog"
					bind:this={closeButton}
				>
					Close
				</button>
			</header>
			<div class="pie-demo-info-dialog__content">
				<h3 class="pie-demo-info-dialog__section-title">Focus</h3>
				<p id="pie-demo-info-dialog-focus" class="pie-demo-info-dialog__paragraph">{resolvedFocus}</p>
				<h3 class="pie-demo-info-dialog__section-title">What Makes It Tick</h3>
				{#if resolvedTickList.length > 0}
					<ul class="pie-demo-info-dialog__list">
						{#each resolvedTickList as point}
							<li>{point}</li>
						{/each}
					</ul>
				{:else}
					<p class="pie-demo-info-dialog__paragraph">
						This demo uses shared route controls and standard section-player wiring.
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.pie-demo-info-dialog {
		position: fixed;
		inset: 0;
		z-index: 120000;
		display: grid;
		place-items: center;
	}

	.pie-demo-info-dialog__backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: rgba(17, 24, 39, 0.56);
		cursor: pointer;
	}

	.pie-demo-info-dialog__panel {
		position: relative;
		width: min(44rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow: auto;
		background: var(--color-base-100, #ffffff);
		color: var(--color-base-content, #111827);
		border: 1px solid color-mix(in srgb, var(--color-base-content) 18%, transparent);
		border-radius: 0.7rem;
		box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.45);
	}

	.pie-demo-info-dialog__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--color-base-content) 14%, transparent);
	}

	.pie-demo-info-dialog__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
	}

	.pie-demo-info-dialog__close-button {
		border: 1px solid color-mix(in srgb, var(--color-base-content) 22%, transparent);
		background: var(--color-base-100, #ffffff);
		color: inherit;
		border-radius: 0.4rem;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.pie-demo-info-dialog__close-button:hover {
		background: color-mix(in srgb, var(--color-primary) 10%, var(--color-base-100));
		border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-base-300));
	}

	.pie-demo-info-dialog__content {
		padding: 0.95rem 1rem 1rem;
		display: grid;
		gap: 0.4rem;
	}

	.pie-demo-info-dialog__section-title {
		margin: 0.2rem 0 0;
		font-size: 0.86rem;
		font-weight: 700;
	}

	.pie-demo-info-dialog__paragraph {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.5;
	}

	.pie-demo-info-dialog__list {
		margin: 0;
		padding-left: 1.05rem;
		display: grid;
		gap: 0.3rem;
		font-size: 0.84rem;
		line-height: 1.45;
	}
</style>
