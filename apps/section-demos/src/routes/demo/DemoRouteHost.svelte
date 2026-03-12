<script lang="ts">
	import LegacyRoutePage from "./[[id]]/+page.svelte";

	interface Props {
		data: any;
	}

	let { data }: Props = $props();
</script>

<LegacyRoutePage {data} />
