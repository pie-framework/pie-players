<script lang="ts">
	import { DemoSiteHeader } from "@pie-players/demo-ui";
	import ThemeSelect from "./ThemeSelect.svelte";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let {
		title = "PIE Assessment Demos",
		subtitle = "Assessment-level orchestration",
	}: Props = $props();
</script>

<DemoSiteHeader {title} {subtitle}>
	{#snippet themeControl()}
		<ThemeSelect />
	{/snippet}
</DemoSiteHeader>
