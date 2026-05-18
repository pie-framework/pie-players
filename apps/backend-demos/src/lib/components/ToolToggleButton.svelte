<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		active: boolean;
		label: string;
		title?: string;
		onToggle: () => void;
		children?: Snippet;
	}

	let { active, label, title = label, onToggle, children }: Props = $props();
</script>

<button
	type="button"
	class="btn btn-sm btn-outline btn-square"
	class:btn-active={active}
	onclick={onToggle}
	{title}
	aria-label={`Toggle ${label} tool`}
	aria-pressed={active}
>
	{@render children?.()}
</button>
