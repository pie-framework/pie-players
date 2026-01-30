<script lang="ts">
	/**
	 * Scientific function buttons component
	 * Trigonometric, logarithmic, and other scientific functions
	 */
	interface Props {
		onFunction: (func: string) => void;
		onInput: (value: string) => void;
	}

	let { onFunction, onInput }: Props = $props();
</script>

<div role="group" aria-label="Scientific functions" class="grid grid-cols-5 gap-2 mb-4">
	<button class="btn btn-sm btn-ghost" onclick={() => onFunction('sin')} aria-label="Sine">
		sin
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onFunction('cos')} aria-label="Cosine">
		cos
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onFunction('tan')} aria-label="Tangent">
		tan
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onFunction('sqrt')} aria-label="Square root">
		√
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onFunction('pow')} aria-label="Power">
		x^y
	</button>
	<button
		class="btn btn-sm btn-ghost"
		onclick={() => onFunction('log')}
		aria-label="Logarithm base 10"
	>
		log
	</button>
	<button
		class="btn btn-sm btn-ghost"
		onclick={() => onFunction('ln')}
		aria-label="Natural logarithm"
	>
		ln
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onInput('(')} aria-label="Open parenthesis">
		(
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onInput(')')} aria-label="Close parenthesis">
		)
	</button>
	<button class="btn btn-sm btn-ghost" onclick={() => onInput('pi')} aria-label="Pi">
		π
	</button>
</div>
