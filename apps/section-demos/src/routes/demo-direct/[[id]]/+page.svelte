<script lang="ts">
	import "@pie-players/pie-section-player/components/section-player-splitpane-element";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const toolkitToolsConfig = {
		floatingTools: {
			calculator: {
				provider: "desmos",
				authFetcher: fetchDesmosAuthConfig,
			},
		},
	};

	async function fetchDesmosAuthConfig() {
		const response = await fetch("/api/tools/desmos/auth");
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

</script>

<svelte:head>
	<title>{data.demo?.name || "Demo"} - Direct Split Layout</title>
</svelte:head>

<div class="direct-layout">
	<pie-section-player-splitpane
		assessment-id={data.demo?.id || "section-demo-direct"}
		section={data.section}
		player-type="iife"
		view="candidate"
		lazy-init={true}
		toolbar-position="right"
		show-toolbar={true}
		enabled-tools="calculator,graph,periodicTable,protractor,lineReader,ruler"
		tools={toolkitToolsConfig}
	></pie-section-player-splitpane>
</div>

<style>
	.direct-layout {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		overflow: hidden;
		padding: 1rem;
		gap: 1rem;
	}

	:global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
</style>
