<script lang="ts">
	import LegacyDemoPage from "../../demo/DemoRouteHost.svelte";

	interface Props {
		data: Record<string, unknown>;
	}

	let { data }: Props = $props();
</script>

<LegacyDemoPage {data} />
