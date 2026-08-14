<script lang="ts">
	import { DemoSiteHeader } from "@pie-players/demo-ui";
	import ThemeSwitcher from "./ThemeSwitcher.svelte";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let {
		title = "PIE Backend Demos",
		subtitle = "Backend integration recipes",
	}: Props = $props();
</script>

<DemoSiteHeader {title} {subtitle}>
	{#snippet themeControl()}
		<ThemeSwitcher />
	{/snippet}
</DemoSiteHeader>
