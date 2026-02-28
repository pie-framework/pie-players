<script lang="ts">
	import "@pie-players/pie-section-player/components/section-player-splitpane-element";
	import { browser } from "$app/environment";
	import type { PageData } from "./$types";

	let { data }: { data: PageData } = $props();

	const PLAYER_OPTIONS = ["iife", "esm", "fixed"] as const;
	function getUrlEnumParam<T extends string>(key: string, options: readonly T[], fallback: T): T {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		return value && options.includes(value as T) ? (value as T) : fallback;
	}
	const selectedPlayerType = getUrlEnumParam("player", PLAYER_OPTIONS, "iife");

	const toolkitToolsConfig = {
	providers: {
			calculator: {
				provider: "desmos",
				authFetcher: fetchDesmosAuthConfig,
			},
		},
	placement: {
		section: ["graph", "periodicTable", "protractor", "lineReader", "ruler"],
		item: ["calculator", "textToSpeech", "answerEliminator"],
		passage: ["textToSpeech"],
	},
	};
	const sectionPlayerRuntime = $derived({
		assessmentId: data.demo?.id || "section-demo-direct",
		playerType: selectedPlayerType,
		lazyInit: true,
		tools: toolkitToolsConfig,
	});

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
		runtime={sectionPlayerRuntime}
		section={data.section}
		view="candidate"
		toolbar-position="right"
		show-toolbar={true}
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
