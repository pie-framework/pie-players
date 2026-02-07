<script lang="ts">
	let { score }: { score: any } = $props();
</script>

<div class="card bg-base-100 shadow-xl">
	<div class="card-body">
		<h3 class="card-title">Score</h3>
		<div class="stats shadow">
			<div class="stat">
				<div class="stat-title">Total</div>
				<div class="stat-value">{score.score ?? 0}</div>
				<div class="stat-desc">out of {score.maxScore ?? 0}</div>
			</div>
		</div>
		<pre
			class="bg-base-300 p-4 rounded text-xs overflow-auto max-h-32">{JSON.stringify(score, null, 2)}</pre>
	</div>
</div>
