<script lang="ts">
	import { DemoSiteHeader, LocaleSelect } from "@pie-players/demo-ui";
	import {
		DEMO_LOCALES,
		demoLocale,
		setDemoLocale,
	} from "$lib/demo-locale.svelte";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let {
		title = "PIE Section Demos",
		subtitle = "Section player recipes",
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
</DemoSiteHeader>
