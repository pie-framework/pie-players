<script lang="ts">
	import { DemoSiteHeader } from "@pie-players/demo-ui";

	type Props = {
		title?: string;
		subtitle?: string;
	};

	let {
		title = "PIE Section Demos",
		subtitle = "Section player recipes",
	}: Props = $props();
</script>

<DemoSiteHeader {title} {subtitle} />
