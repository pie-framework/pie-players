<script lang="ts">
	import SectionDemoRuntimePage from '$lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<!--
	The one demo that opts into a locale. `localeSwitcher` both renders the
	selector in the menu bar and passes the chosen tag to the player; no other
	route sets it, so the rest of the app stays on the English a host that
	supplies nothing gets.
-->
<SectionDemoRuntimePage {data} localeSwitcher />
