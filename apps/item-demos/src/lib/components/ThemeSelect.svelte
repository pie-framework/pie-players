<script lang="ts">
	import { DAISY_THEMES, selectedTheme, setTheme } from '$lib/stores/theme';
</script>

<label class="flex items-center gap-2">
	<span class="sr-only">Select theme</span>
	<select
		class="select select-sm select-bordered"
		value={$selectedTheme}
		onchange={(e) => setTheme((e.currentTarget as HTMLSelectElement).value)}
		aria-label="Select theme"
		title="Select theme"
	>
		{#each DAISY_THEMES as theme}
			<option value={theme}>{theme}</option>
		{/each}
	</select>
</label>
