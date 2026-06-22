<script lang="ts">
	import SectionDemoRuntimePage from '$lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<SectionDemoRuntimePage {data} />
