<script lang="ts">
	let { session }: { session: any } = $props();
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h3 class="card-title">Session State</h3>
		<pre
			class="bg-base-300 p-4 rounded text-xs overflow-auto max-h-64">{JSON.stringify(session, null, 2)}</pre>
	</div>
</div>
