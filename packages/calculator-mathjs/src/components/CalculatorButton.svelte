<script lang="ts">
	/**
	 * Individual calculator button component
	 * Handles button rendering with proper ARIA attributes and styling
	 */
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		label: string;
		ariaLabel?: string;
		variant?: 'default' | 'primary' | 'error' | 'success' | 'warning' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		square?: boolean;
		wide?: boolean;
		onclick?: (e: MouseEvent) => void;
	}

	let {
		label,
		ariaLabel,
		variant = 'default',
		size = 'lg',
		square = true,
		wide = false,
		onclick,
		...restProps
	}: Props = $props();

	const buttonClasses = $derived(() => {
		const classes = ['btn'];

		if (square) classes.push('btn-square');
		if (size) classes.push(`btn-${size}`);
		if (wide) classes.push('col-span-2');

		switch (variant) {
			case 'primary':
				classes.push('btn-primary');
				break;
			case 'error':
				classes.push('btn-error');
				break;
			case 'success':
				classes.push('btn-success');
				break;
			case 'warning':
				classes.push('btn-warning');
				break;
			case 'ghost':
				classes.push('btn-ghost');
				break;
		}

		return classes.join(' ');
	});
</script>

<button
	role="gridcell"
	class={buttonClasses()}
	aria-label={ariaLabel || label}
	{onclick}
	{...restProps}
>
	{label}
</button>

<style>
	/* Additional button-specific styles if needed */
	button {
		/* Ensure minimum touch target size */
		min-height: 48px;
		min-width: 48px;
	}
</style>
