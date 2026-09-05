<script lang="ts">
	import "@pie-players/pie-assessment-player/components/assessment-player-default-element";
</script>

<svelte:head>
	<title>Assessment lifecycle host</title>
</svelte:head>

<h1>Assessment lifecycle host</h1>
<div data-pie-assessment-fixture></div>

<style>
	[data-pie-assessment-fixture] {
		height: 42rem;
		min-height: 0;
	}
</style>
