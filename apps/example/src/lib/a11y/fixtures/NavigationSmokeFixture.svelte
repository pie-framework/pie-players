<script lang="ts">
	import { base } from '$app/paths';
</script>

<div class="card bg-base-100 shadow-xl" data-testid="a11y-fixture-root">
	<div class="card-body">
		<h2 class="card-title">Navigation smoke fixture</h2>
		<p class="text-sm opacity-80">Basic nav/link semantics for axe scans.</p>

		<nav aria-label="Fixture navigation">
			<ul class="menu bg-base-200 rounded-box">
				<li><a href={`${base}/samples/`}>Item Samples</a></li>
				<li><a href={`${base}/playground/`}>Playground</a></li>
				<li><a href={`${base}/a11y-components/`}>A11y</a></li>
			</ul>
		</nav>
	</div>
</div>


