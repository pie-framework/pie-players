<script lang="ts">
	import ThreeQuestionsDemoPage from '../three-questions/+page.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<ThreeQuestionsDemoPage {data} />
