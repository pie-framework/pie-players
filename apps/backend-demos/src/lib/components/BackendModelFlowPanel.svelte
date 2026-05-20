<script lang="ts">
	import JsonInspectPanel from "./JsonInspectPanel.svelte";

	interface Props {
		rawConfig: unknown;
		processedModel: unknown;
		databaseMetadata: unknown;
	}

	let { rawConfig, processedModel, databaseMetadata }: Props = $props();
</script>

<div class="grid gap-4 p-4">
	<section class="rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">Raw SQLite config</h3>
		</header>
		<JsonInspectPanel
			value={rawConfig}
			description="The backend stores the authored item, including fields that should not be sent directly to the student."
		/>
	</section>

	<section class="rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">Controller-processed model</h3>
		</header>
		<JsonInspectPanel
			value={processedModel}
			description="/api/player/model runs controller model() and returns the student-safe model."
		/>
	</section>

	<section class="rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">SQLite metadata</h3>
		</header>
		<JsonInspectPanel
			value={databaseMetadata}
			description="The demo database lives on disk so reloads can hydrate saved sessions."
		/>
	</section>
</div>
