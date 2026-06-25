<script lang="ts">
	import { browser } from '$app/environment';
	import {
		applyDaisyTheme,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
	} from '$lib/demo-runtime/demo-page-helpers';
	import '../app.css';

	$effect(() => {
		if (!browser) return;
		const storedDaisyTheme =
			window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME;
		applyDaisyTheme(storedDaisyTheme, () => {});
	});
</script>

<svelte:head>
	<link rel="icon" href="/pie-favicon.svg" type="image/svg+xml" />
</svelte:head>

<slot />
