<script lang="ts">
	import LegacyDemoHost from "../../_shared/LegacyDemoHost.svelte";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();
</script>

<LegacyDemoHost {data} />
