<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	let { data } = $props();

	onMount(() => {
		// Redirect to delivery view with current query params
		goto(`/demo/${data.demoId}/delivery?${$page.url.searchParams}`, {
			replaceState: true
		});
	});
</script>

<div class="flex items-center justify-center min-h-64">
	<span class="loading loading-spinner loading-lg"></span>
</div>
