<script lang="ts">
	import JsonInspectPanel from "./JsonInspectPanel.svelte";

	interface Props {
		clientSession: unknown;
		storedSession: unknown;
	}

	let { clientSession, storedSession }: Props = $props();
</script>

<div class="grid gap-4 p-4">
	<section class="rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">Client session</h3>
		</header>
		<JsonInspectPanel
			value={clientSession}
			testId="client-session"
			description="Latest session emitted by the item player."
		/>
	</section>

	<section class="rounded-box border border-base-300">
		<header class="border-b border-base-300 px-4 py-3">
			<h3 class="text-sm font-semibold">Stored backend session</h3>
		</header>
		<JsonInspectPanel
			value={storedSession}
			testId="stored-session"
			description="Session currently persisted in the local SQLite backend."
		/>
	</section>
</div>
