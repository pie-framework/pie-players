<script lang="ts">
	import TabbedLayoutVariant from '../TabbedLayoutVariant.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<TabbedLayoutVariant {data} variant="splitpane-tabbed-collapse" />
