<script lang="ts">
	import '../app.css';
	import '@pie-players/pie-theme';
	import '@pie-players/pie-theme/components.css';
	import { initTheme, selectedTheme } from '$lib/stores/theme';

	let { children } = $props();

	// Seed the store from persisted state once on the client. The pre-paint
	// inline script in app.html has already set data-theme to avoid a flash;
	// from here on the <pie-theme scope="document"> host below owns both
	// data-theme on <html> and the --pie-* token variables that cascade into
	// PIE content (so item choices follow the theme, like in section-demos).
	$effect(() => {
		initTheme();
	});
</script>

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme={$selectedTheme}>
	{@render children?.()}
</pie-theme>
