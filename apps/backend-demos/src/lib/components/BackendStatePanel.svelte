<script lang="ts">
	import JsonInspectPanel from "./JsonInspectPanel.svelte";
	import SessionInspectPanel from "./SessionInspectPanel.svelte";

	interface Props {
		clientSession: unknown;
		storedSession: unknown;
		backendScore: unknown;
	}

	let { clientSession, storedSession, backendScore }: Props = $props();
</script>

<div class="grid gap-4">
	<SessionInspectPanel {clientSession} {storedSession} />

	<section class="mx-4 mb-4 rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">Backend outcome</h3>
		</header>
		<JsonInspectPanel
			value={backendScore}
			testId="backend-outcome"
			description="Result from the backend controller outcome() endpoint."
		/>
	</section>
</div>
