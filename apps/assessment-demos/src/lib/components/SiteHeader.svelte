<script lang="ts">
	import { DemoSiteHeader, LocaleSelect } from "@pie-players/demo-ui";
	import ThemeSelect from "./ThemeSelect.svelte";
	import { DEMO_LOCALES, demoLocale, setDemoLocale } from "$lib/demo-locale.svelte";

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
	{#snippet localeControl()}
		<LocaleSelect
			locales={DEMO_LOCALES}
			value={demoLocale()}
			onSelect={setDemoLocale}
		/>
	{/snippet}
	{#snippet themeControl()}
		<ThemeSelect />
	{/snippet}
</DemoSiteHeader>
