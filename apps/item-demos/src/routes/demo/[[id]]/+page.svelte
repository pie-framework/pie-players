<script lang="ts">
	
	import { onMount } from 'svelte';
import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();

	const demoId = $derived(data.demoId);

	onMount(() => {
		// Redirect to delivery view with current query params
		goto(`/demo/${demoId}/delivery?${page.url.searchParams}`, {
			replace: true
		});
	});
</script>

<div class="flex items-center justify-center min-h-64">
	<span class="loading loading-spinner loading-lg"></span>
</div>
