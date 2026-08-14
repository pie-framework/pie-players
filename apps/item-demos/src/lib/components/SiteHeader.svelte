<script lang="ts">
	import { DemoSiteHeader } from "@pie-players/demo-ui";
	import ThemeSelect from "./ThemeSelect.svelte";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let { title = "PIE Item Demos", subtitle = "Item player recipes" }: Props =
		$props();
</script>

<DemoSiteHeader {title} {subtitle}>
	{#snippet themeControl()}
		<ThemeSelect />
	{/snippet}
</DemoSiteHeader>
