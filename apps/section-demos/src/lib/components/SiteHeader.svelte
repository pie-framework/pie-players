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

<!--
	No locale control here. The interface locale belongs to the one demo that
	demonstrates it, so a tag chosen there cannot follow the reader into demos
	meant to show the English a host with no locale gets.
-->
<DemoSiteHeader {title} {subtitle} />
