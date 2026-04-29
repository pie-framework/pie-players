<!--
	ToolIcon - Sanitized inline SVG renderer for toolbar buttons.

	Tool configurations supply icons either as inline SVG strings, an
	external URL, or an icon-font class name. When an inline SVG is
	provided we route it through the shared DOMPurify-based SVG sanitizer
	before injecting via `{@html}`, preventing tool authors from shipping
	`<script>` tags, event-handler attributes, or foreignObject sinks.
-->
<script lang="ts">
	import { sanitizeSvgIcon } from '@pie-players/pie-players-shared/security';

	let { icon, className = '' }: { icon: string | undefined; className?: string } = $props();

	const safeIcon = $derived(typeof icon === 'string' ? sanitizeSvgIcon(icon) : '');
</script>

{#if safeIcon}
	<span class={className} aria-hidden="true">
		{@html safeIcon}
	</span>
{/if}
