<svelte:head>
	<title>PIE Item Player - Demo App</title>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<header class="text-center mb-12">
		<h1 class="text-5xl font-bold mb-4">PIE Item Player Demos</h1>
		<p class="text-xl text-base-content/70 max-w-2xl mx-auto">
			Progressive examples using the IIFE player for individual PIE items
		</p>
	</header>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
		<!-- Demo: Multiple Choice Question -->
		<a
			href="/demo/multiple-choice/delivery"
			class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
		>
			<div class="card-body">
				<h2 class="card-title text-2xl mb-4">Multiple Choice</h2>
				<p class="text-base-content/70 mb-4">
					Single multiple-choice question rendered with the IIFE player.
				</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary">Start Demo &#8594;</button>
				</div>
			</div>
		</a>

		<!-- Demo: Passage Item -->
		<a
			href="/demo/passage/delivery"
			class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
		>
			<div class="card-body">
				<h2 class="card-title text-2xl mb-4">Passage Item</h2>
				<p class="text-base-content/70 mb-4">
					Passage element with formatted HTML content. Read-only, no interaction.
				</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary">Start Demo &#8594;</button>
				</div>
			</div>
		</a>

		<!-- Demo: Math Expression -->
		<a
			href="/demo/math-expression/delivery"
			class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-200 hover:-translate-y-1"
		>
			<div class="card-body">
				<h2 class="card-title text-2xl mb-4">Math Expression</h2>
				<p class="text-base-content/70 mb-4">
					Quadratic equation with constructed response input fields and math rendering.
				</p>
				<div class="card-actions justify-end">
					<button class="btn btn-primary">Start Demo &#8594;</button>
				</div>
			</div>
		</a>
	</div>

</div>
