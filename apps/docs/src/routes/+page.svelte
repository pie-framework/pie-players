<script lang="ts">
	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	// Avoid prerender crawling the /examples app in production.
	const examplesHref = dev ? `${base}/examples/` : 'https://pie-framework.github.io/pie-players/examples/';
</script>

<svelte:head>
	<title>PIE Players</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
	<section class="py-8 lg:py-14">
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
			<div>
				<h1 class="text-4xl lg:text-5xl font-bold tracking-tight">PIE Players</h1>
				<p class="mt-4 text-lg opacity-80">
					A monorepo of production-ready players and tools for rendering <strong>PIE</strong> content across multiple delivery modes.
				</p>

				<div class="mt-6 flex flex-wrap gap-2">
					<span class="badge badge-success badge-lg">Inline</span>
					<span class="badge badge-success badge-lg">Fixed</span>
					<span class="badge badge-success badge-lg">IIFE</span>
					<span class="badge badge-success badge-lg">ESM</span>
					<span class="badge badge-info badge-lg">Bun + Turbo</span>
					<span class="badge badge-info badge-lg">Accessibility testing</span>
				</div>

				<div class="mt-8 flex flex-wrap gap-3">
					<a class="btn btn-primary" href={examplesHref} target={dev ? undefined : '_blank'} rel="noreferrer">
						Live Examples
					</a>
					<a
						class="btn btn-outline"
						href="https://github.com/pie-framework/pie-players"
						target="_blank"
						rel="noreferrer"
					>
						GitHub
					</a>
					<a class="btn btn-ghost" href="https://pie-framework.org/" target="_blank" rel="noreferrer">
						What is PIE?
					</a>
				</div>

				<div class="mt-8 stats shadow bg-base-100 w-full">
					<div class="stat">
						<div class="stat-title">Players</div>
						<div class="stat-value text-primary">4</div>
						<div class="stat-desc">Inline, Fixed, IIFE, ESM</div>
					</div>
					<div class="stat">
						<div class="stat-title">Tooling</div>
						<div class="stat-value">Shared</div>
						<div class="stat-desc">Authoring + utilities</div>
					</div>
					<div class="stat">
						<div class="stat-title">Evals</div>
						<div class="stat-value">Playwright</div>
						<div class="stat-desc">E2E + a11y</div>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<div class="mockup-browser border border-base-300 bg-base-200">
						<div class="mockup-browser-toolbar">
							<div class="input border border-base-300 bg-base-100">pie-framework.github.io/pie-players/examples</div>
						</div>
						<div class="bg-base-100 p-3">
							<div class="rounded-lg border border-base-200 p-4">
								<p class="font-semibold">Try the examples site</p>
								<p class="text-sm opacity-70 mt-1">
									Samples, playground, authoring flows, and deterministic fixtures for testing.
								</p>
								<div class="mt-4">
									<a class="btn btn-sm btn-outline" href={examplesHref} target={dev ? undefined : '_blank'} rel="noreferrer">
										Open examples
									</a>
								</div>
							</div>
						</div>
					</div>
					<p class="mt-3 text-sm opacity-70">
						The docs front site is intentionally brief; the examples app is where most interactive demos live.
					</p>
				</div>
			</div>
		</div>
	</section>

	<section class="py-10">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">What’s in here</h2>
					<ul class="mt-2 space-y-1 opacity-80">
						<li><strong>Players</strong>: multiple embedding/deployment modes</li>
						<li><strong>Example app</strong>: live demos + a11y fixtures</li>
						<li><strong>Shared packages</strong>: utilities + assessment toolkit</li>
					</ul>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Packages</h2>
					<ul class="mt-2 space-y-1 opacity-80">
						<li><code>@pie-framework/pie-inline-player</code></li>
						<li><code>@pie-framework/pie-fixed-player</code></li>
						<li><code>@pie-framework/pie-iife-player</code></li>
						<li><code>@pie-framework/pie-esm-player</code></li>
						<li><code>@pie-framework/pie-players-shared</code></li>
						<li><code>@pie-framework/pie-assessment-toolkit</code></li>
					</ul>
					<div class="card-actions justify-end mt-4">
						<a class="btn btn-sm btn-outline" href="https://github.com/pie-framework/pie-players/tree/main/packages" target="_blank" rel="noreferrer">
							Browse packages
						</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Develop</h2>
					<pre class="mockup-code mt-3"><code># install
bun install

# run docs + examples
bun run dev:docs
bun run dev:example

# preview GitHub Pages build
bun run build:pages</code></pre>
				</div>
			</div>
		</div>
	</section>
</div>

