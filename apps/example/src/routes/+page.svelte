<svelte:head>
	<title>PIE Players - Home</title>
</svelte:head>

<script lang="ts">
	import { base } from '$app/paths';

	function href(path: string) {
		return `${base}${path}`;
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Hero Section -->
	<div class="hero bg-base-200 py-20">
		<div class="hero-content text-center">
			<div class="max-w-2xl">
				<div class="flex gap-4 justify-center flex-wrap">
					<a href={href('/samples/')} class="btn btn-primary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
						Browse Item Samples
					</a>
					<a href={href('/assessment/')} class="btn btn-primary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						Assessment Demo
					</a>
					<a href={href('/playground/')} class="btn btn-primary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Try Playground
					</a>
					<a href={href('/a11y-components/')} class="btn btn-secondary btn-lg">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-6 w-6"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						A11y Testing
					</a>
				</div>
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div class="container mx-auto px-6 py-12">
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
						<h2 class="card-title">Item Samples</h2>
					</div>
					<p class="opacity-80">Browse bundled PIE example items.</p>
					<div class="card-actions justify-end mt-4">
						<a href={href('/samples/')} class="btn btn-sm btn-primary">Explore</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						<h2 class="card-title">Assessment Demo</h2>
					</div>
					<p class="opacity-80">Run a full assessment flow (local no-backend demo using an in-memory item bank).</p>
					<div class="card-actions justify-end mt-4">
						<a href={href('/assessment/')} class="btn btn-sm btn-primary">Open</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
							/>
						</svg>
						<h2 class="card-title">Playground</h2>
					</div>
					<p class="opacity-80">Paste/edit PIE item JSON and preview rendering in real-time.</p>
					<div class="card-actions justify-end mt-4">
						<a href={href('/playground/')} class="btn btn-sm btn-primary">Try It</a>
					</div>
				</div>
			</div>

			<div class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-8 w-8 text-secondary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<h2 class="card-title">A11y Testing</h2>
					</div>
					<p class="opacity-80">Deterministic fixture pages for Playwright + axe-core accessibility checks.</p>
					<div class="card-actions justify-end mt-4">
						<a href={href('/a11y-components/')} class="btn btn-sm btn-secondary">View Tests</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>


