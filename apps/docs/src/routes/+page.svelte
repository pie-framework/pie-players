<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>PIE Players and Assessment Toolkit</title>
	<meta
		name="description"
		content="Production-ready players and tools for rendering PIE content across multiple delivery modes with complete assessment infrastructure."
	/>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<!-- Header -->
	<div class="mb-12">
		<h1 class="text-5xl font-bold text-secondary mb-4">PIE Players and Assessment Toolkit</h1>
		<p class="text-xl text-base-content/70 max-w-3xl">
			From individual elements to complete assessments: players orchestrate content delivery while
			the toolkit provides tools, accommodations, and test infrastructure.
		</p>
	</div>

	<!-- Players Overview -->
	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Players Overview</h2>

		<div class="prose max-w-none mb-8">
			<p class="text-lg">
				While elements represent individual question types, <strong>players</strong> orchestrate how
				elements are rendered, managed, and integrated into assessment experiences. PIE provides players
				at three levels of granularity.
			</p>
		</div>

		<div class="my-8">
			<img
				src="{base}/images/docs/players/pie-item-players.png"
				alt="PIE Item Players"
				width="2816"
				height="1536"
				loading="lazy"
				class="rounded-lg shadow-lg w-full max-w-4xl mx-auto"
			/>
		</div>

		<div class="grid md:grid-cols-3 gap-6 mb-8">
			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-primary">Element Player</h3>
					<p class="text-sm mb-3">
						Renders a single element (one question type). Primarily used for testing and
						development.
					</p>
					<ul class="text-xs space-y-1">
						<li>• Loads element JavaScript bundle</li>
						<li>• Manages element state</li>
						<li>• Handles mode transitions</li>
						<li>• Emits session change events</li>
					</ul>
				</div>
			</div>

			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-primary">Item Player</h3>
					<p class="text-sm mb-3">
						Renders complete assessment items with one or more questions, passages, and rubrics.
					</p>
					<ul class="text-xs space-y-1">
						<li>• Manages multiple elements</li>
						<li>• Handles passages and rubrics</li>
						<li>• Unified session model</li>
						<li>• Built-in layout system</li>
					</ul>
				</div>
			</div>

			<div class="card bg-base-100 shadow-xl border border-base-300">
				<div class="card-body">
					<h3 class="card-title text-primary">Assessment Player</h3>
					<p class="text-sm mb-3">
						Complete test delivery with navigation, tools, and accommodations. Reference
						implementation.
					</p>
					<ul class="text-xs space-y-1">
						<li>• Item navigation</li>
						<li>• Toolkit integration</li>
						<li>• Timer and controls</li>
						<li>• Multi-item orchestration</li>
					</ul>
				</div>
			</div>
		</div>
	</section>

	<!-- Player Types -->
	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Player Types</h2>

		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				PIE provides multiple player implementations, each optimized for different deployment
				scenarios. All implement the same Web Component interface, making them interchangeable.
			</p>
		</div>

		<div class="my-8">
			<img
				src="{base}/images/docs/players/pie-itemplayer-packaging-strategies.png"
				alt="PIE Item Player Packaging Strategies"
				width="2816"
				height="1536"
				loading="lazy"
				class="rounded-lg shadow-lg w-full max-w-4xl mx-auto"
			/>
		</div>

		<div class="space-y-6">
			<!-- IIFE Player (Current Standard) -->
			<div class="card bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700">
				<div class="card-body">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3 mb-3">
								<h3 class="card-title">IIFE Player</h3>
								<span class="badge badge-primary">Current Standard</span>
							</div>
							<p class="mb-4">
								Loads pre-bundled element packages dynamically from a bundle hosting service. The current production-ready player with broad browser support and battle-tested reliability.
							</p>
							<div class="grid md:grid-cols-2 gap-4 text-sm">
								<div>
									<p class="font-semibold text-success mb-2">Benefits:</p>
									<ul class="list-disc list-inside text-xs space-y-1">
										<li>Production-ready and stable</li>
										<li>Broad browser support</li>
										<li>Dynamic element loading</li>
										<li>Enterprise-proven at scale</li>
									</ul>
								</div>
								<div>
									<p class="font-semibold text-info mb-2">Status:</p>
									<ul class="list-disc list-inside text-xs space-y-1">
										<li>Current standard for production</li>
										<li>Will transition to legacy in 2026</li>
										<li>Fully supported through 2027+</li>
										<li>Recommended for new projects today</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- ESM Player (Future) -->
			<div class="card bg-base-100 border border-warning border-2">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-3">
						<h3 class="card-title">ESM Player</h3>
						<span class="badge badge-warning">Coming Early 2026</span>
					</div>
					<div class="alert alert-warning mb-4">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						<span class="text-sm font-semibold">Not production-ready yet. Expected early 2026.</span>
					</div>
					<p class="mb-4">
						Uses native browser ESM (ECMAScript Modules) for loading PIE elements. Will offer smaller bundle sizes and better caching once ready for production.
					</p>
					<div class="grid md:grid-cols-2 gap-4 text-sm">
						<div>
							<p class="font-semibold text-success mb-2">Future Benefits:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>Much smaller, cacheable bundles</li>
								<li>Native browser module loading</li>
								<li>Better dependency caching</li>
								<li>Import maps for resolution</li>
							</ul>
						</div>
						<div>
							<p class="font-semibold text-warning mb-2">Current Status:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>In development</li>
								<li>Not recommended for production</li>
								<li>Expected stable: early 2026</li>
								<li>Will become new standard</li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<!-- Fixed Player -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-3">
						<h3 class="card-title">Fixed Player</h3>
					</div>
					<p class="mb-4">
						Elements are bundled directly into the player at build time. Optimal for
						performance-critical deployments with known question type sets.
					</p>
					<div class="grid md:grid-cols-2 gap-4 text-sm">
						<div>
							<p class="font-semibold text-success mb-2">Benefits:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>Zero runtime bundle loading</li>
								<li>Smallest API payload (data only)</li>
								<li>Fastest initial render</li>
								<li>Deterministic builds</li>
							</ul>
						</div>
						<div>
							<p class="font-semibold text-warning mb-2">Constraints:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>Fixed element versions</li>
								<li>Requires rebuild for updates</li>
								<li>Larger player bundle</li>
								<li>Less flexible</li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<!-- Inline Player -->
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<div class="flex items-center gap-3 mb-3">
						<h3 class="card-title">Inline Player</h3>
						<span class="badge badge-secondary">Svelte Component</span>
					</div>
					<p class="mb-4">
						Pure Svelte component implementation for direct framework integration. Use when you need tight integration with a Svelte application.
					</p>
					<div class="grid md:grid-cols-2 gap-4 text-sm">
						<div>
							<p class="font-semibold text-success mb-2">Benefits:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>Native Svelte reactivity</li>
								<li>TypeScript support</li>
								<li>No Shadow DOM overhead</li>
								<li>Direct component composition</li>
							</ul>
						</div>
						<div>
							<p class="font-semibold text-info mb-2">Use Cases:</p>
							<ul class="list-disc list-inside text-xs space-y-1">
								<li>SvelteKit applications</li>
								<li>Svelte-based authoring tools</li>
								<li>Component-level integration</li>
								<li>Server-side rendering</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		</div>

	</section>

	<!-- Assessment Toolkit -->
	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Assessment Toolkit Architecture</h2>

		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				Real-world assessments require more than question rendering. The PIE Assessment Toolkit
				provides composable services for tools, accommodations, and complete test delivery.
			</p>
		</div>

		<div class="my-8">
			<img
				src="{base}/images/docs/assessment-toolkit/pie-assessment-toolkit-arch.png"
				alt="PIE Assessment Toolkit Architecture"
				width="2816"
				height="1536"
				loading="lazy"
				class="rounded-lg shadow-lg w-full max-w-4xl mx-auto"
			/>
		</div>

		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">ToolCoordinator</h4>
					<p class="text-sm">
						Central service managing tool visibility and z-index layering for proper stacking of
						calculators, rulers, and other tools.
					</p>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">HighlightCoordinator</h4>
					<p class="text-sm">
						Manages text highlighting for TTS and annotations using CSS Custom Highlight API for
						framework-friendly overlays.
					</p>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">TTSService</h4>
					<p class="text-sm">
						Singleton text-to-speech service with word-level highlighting synchronization and voice
						control.
					</p>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">ThemeProvider</h4>
					<p class="text-sm">
						Accessibility theming for high contrast modes, color schemes, and font size adjustments
						via CSS custom properties.
					</p>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">ToolConfigResolver</h4>
					<p class="text-sm">
						Resolves three-tier accommodation configuration (student IEP/504, roster settings, item
						requirements).
					</p>
				</div>
			</div>

			<div class="card bg-base-100 border border-base-300">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-2">TypedEventBus</h4>
					<p class="text-sm">
						Type-safe communication layer for component coordination without direct coupling.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Tools & Accommodations -->
	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Tools & Accommodations</h2>

		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				The toolkit includes 15+ assessment tools organized in three tiers based on dependencies and
				functionality.
			</p>
		</div>

		<div class="my-8">
			<img
				src="{base}/images/docs/assessment-toolkit/pie-tool-tiers.png"
				alt="PIE Tool Tiers"
				width="2816"
				height="1536"
				loading="lazy"
				class="rounded-lg shadow-lg w-full max-w-4xl mx-auto"
			/>
		</div>

		<div class="grid md:grid-cols-3 gap-6 mb-8">
			<div class="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
				<div class="card-body">
					<div class="badge badge-info mb-3">Tier 1</div>
					<h4 class="font-bold mb-2">Standalone Tools</h4>
					<p class="text-sm mb-3">Direct user interaction, no dependencies</p>
					<ul class="text-xs space-y-1">
						<li>• Calculator (scientific, graphing)</li>
						<li>• Ruler (metric, imperial)</li>
						<li>• Protractor</li>
						<li>• Periodic Table</li>
						<li>• Line Reader</li>
						<li>• Magnifier</li>
						<li>• Color Scheme selector</li>
					</ul>
				</div>
			</div>

			<div class="card bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700">
				<div class="card-body">
					<div class="badge badge-secondary mb-3">Tier 2</div>
					<h4 class="font-bold mb-2">Orchestrator Tools</h4>
					<p class="text-sm mb-3">Enable other tools by detecting user intent</p>
					<ul class="text-xs space-y-1">
						<li>• Annotation Toolbar (detects selection)</li>
						<li>• Answer Eliminator (manages masking)</li>
						<li>• Main Toolbar (launches tools)</li>
					</ul>
				</div>
			</div>

			<div class="card bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
				<div class="card-body">
					<div class="badge badge-warning mb-3">Tier 3</div>
					<h4 class="font-bold mb-2">Dependent Tools</h4>
					<p class="text-sm mb-3">Require Tier 2 input to function</p>
					<ul class="text-xs space-y-1">
						<li>• Text-to-Speech (from selection)</li>
						<li>• Dictionary lookup</li>
						<li>• Translation</li>
					</ul>
				</div>
			</div>
		</div>

		<div class="card bg-success/10 border border-success/30">
			<div class="card-body">
				<div class="flex items-start gap-4">
					<svg
						class="w-8 h-8 text-success flex-shrink-0"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
					<div>
						<h4 class="font-bold text-success text-lg mb-2">WCAG 2.2 Level AA Compliance</h4>
						<p class="text-sm">
							All toolkit features target WCAG 2.2 Level AA standards: keyboard navigation, screen
							reader support, color contrast, touch targets, and alternative content access.
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Integration Patterns -->
	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Integration Patterns</h2>

		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				Players communicate through standard DOM APIs: properties for configuration, events for
				state changes, and methods for programmatic control.
			</p>
		</div>

		<div class="my-8">
			<img
				src="{base}/images/docs/assessment-toolkit/pie-integration-flow.png"
				alt="PIE Integration Flow"
				width="2816"
				height="1536"
				loading="lazy"
				class="rounded-lg shadow-lg w-full max-w-4xl mx-auto"
			/>
		</div>

		<div class="grid md:grid-cols-3 gap-6 mb-8">
			<div class="card bg-base-200">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-3">Properties (Input)</h4>
					<div class="mockup-code text-xs">
						<pre><code>player.config = itemConfig;

player.env = {'{'}
  mode: 'gather',
  role: 'student'
{'}'};

player.session = {'{'}
  id: 'session-123',
  data: []
{'}'};</code></pre>
					</div>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-3">Events (Output)</h4>
					<div class="mockup-code text-xs">
						<pre><code>player.addEventListener(
  'session-changed',
  (e) => {'{'}
    save(e.detail);
  {'}'}
);

player.addEventListener(
  'load-complete',
  () => console.log('Ready')
);</code></pre>
					</div>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body">
					<h4 class="font-bold text-primary mb-3">Methods (Control)</h4>
					<div class="mockup-code text-xs">
						<pre><code>// Calculate score
const outcome =
  await player
    .provideScore();

// Reset state
player.reset();

// Validate
player.validate();</code></pre>
					</div>
				</div>
			</div>
		</div>

		<div class="alert alert-warning">
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			<div>
				<p class="font-semibold">Three-Tier Accommodation Configuration</p>
				<p class="text-sm">
					Tool availability is resolved from three sources with precedence rules: (1) Roster block
					(highest), (2) Item restrictions/requirements, (3) Student accommodations (IEP/504), (4)
					Roster defaults, (5) System defaults.
				</p>
			</div>
		</div>
	</section>

	<!-- Getting Started -->
	<section>
		<h2 class="text-3xl font-bold text-secondary mb-6">Getting Started</h2>

		<div class="grid md:grid-cols-1 gap-6">
			<a
				href="https://github.com/pie-framework/pie-players"
				target="_blank"
				rel="noreferrer"
				class="card bg-base-100 shadow-xl border border-base-300 hover:shadow-2xl transition-shadow"
			>
				<div class="card-body">
					<h3 class="card-title text-primary">
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path
								fill-rule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								clip-rule="evenodd"
							/>
						</svg>
						View on GitHub
					</h3>
					<p class="text-sm">
						Browse the source code, read documentation, report issues, and contribute to the PIE Players project.
					</p>
				</div>
			</a>
		</div>

		<div class="card bg-primary text-primary-content shadow-xl mt-8">
			<div class="card-body">
				<h3 class="card-title text-2xl mb-3">Quick Start</h3>
				<pre class="mockup-code bg-base-100 text-base-content mt-3"><code># Install dependencies
bun install

# Run docs site
bun run dev:docs

# Build for production
bun run build

# Preview GitHub Pages build
bun run build:pages</code></pre>
			</div>
		</div>
	</section>
</div>
