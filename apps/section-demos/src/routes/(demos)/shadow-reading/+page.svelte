<script lang="ts">
	import { onMount } from 'svelte';
	import SectionDemoRuntimePage from '#lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import { attachShadowReadingRoots } from '#lib/demo-runtime/shadow-reading-roots.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => attachShadowReadingRoots());
</script>

<SectionDemoRuntimePage {data} />
