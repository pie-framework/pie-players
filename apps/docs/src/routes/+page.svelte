<script lang="ts">
	const docs = 'https://github.com/pie-framework/pie-players/blob/develop/';

	const players = [
		{
			name: 'Item player',
			tag: '<pie-item-player>',
			summary: 'One item for delivery, evaluation or authoring.',
			points: [
				'Loads its elements under the iife, esm or preloaded strategy',
				'Keeps the item session and emits session-changed',
				'Scores in the browser or through a server',
				'Validates element models while authoring'
			]
		},
		{
			name: 'Section player',
			tag: '<pie-section-player-splitpane>, -vertical, -tabbed',
			summary: 'One section: passages and items in a split-pane, vertical or tabbed layout.',
			points: [
				'Item and passage toolbars',
				'Navigation within the section',
				'Section session state through the SectionController',
				'Formative check-answer delivery'
			]
		},
		{
			name: 'Print player',
			tag: '<pie-print>',
			summary: "Items for paper and answer keys, from the elements' print views.",
			points: ['Learner copies and answer keys', 'Accessibility alternates in print']
		},
		{
			name: 'Assessment player',
			tag: '<pie-assessment-player>',
			summary:
				'A reference assembly of the section player and the toolkit across sections. Production assessment players are host-built from the same parts.',
			points: [
				'Navigation across sections',
				'Assessment session persistence',
				'AssessmentController events'
			]
		}
	];

	const strategies = [
		{
			name: 'iife',
			badge: 'Default',
			summary:
				'Injects IIFE bundles from the PIE bundle host as script tags. The bundle host builds bundles of the element packages an item names.',
			fit: 'Serves the legacy pie-elements packages and pie-elements-ng alike.'
		},
		{
			name: 'esm',
			badge: null,
			summary:
				"Imports the elements' browser ESM builds from an npm CDN, by URL or through an import map.",
			fit: 'Needs element packages that publish browser ESM builds, as pie-elements-ng does.'
		},
		{
			name: 'preloaded',
			badge: null,
			summary:
				'Asserts that the host already registered the elements. The preloaded player package bundles a fixed element set with the item player.',
			fit: 'Section-level preloading, static builds and offline use.'
		}
	];

	const services = [
		{
			name: 'ToolkitCoordinator',
			summary:
				'Owns the toolkit services for an assessment and resolves which tools each learner receives.'
		},
		{
			name: 'ToolCoordinator',
			summary: 'Tool visibility and stacking order for calculators, rulers and other floating tools.'
		},
		{
			name: 'HighlightCoordinator',
			summary: 'Read-aloud and annotation highlights through the CSS Custom Highlight API.'
		},
		{
			name: 'TTSService',
			summary: 'Speech with word-level highlighting, over a browser or server provider.'
		},
		{
			name: 'AccessibilityCatalogResolver',
			summary: 'Authored spoken text, audio, sign-language video and braille for the content on screen.'
		}
	];

	const toolGroups = [
		{
			name: 'Tools',
			items: [
				'Calculators',
				'Graph',
				'Ruler and protractor',
				'Periodic table',
				'Line reader',
				'Dictionaries and picture dictionaries',
				'Color schemes'
			]
		},
		{
			name: 'Toolbars and content tools',
			items: [
				'Item, passage and section toolbars',
				'Annotation toolbar',
				'Answer eliminator',
				'Inline read-aloud'
			]
		},
		{
			name: 'Providers and accommodations',
			items: [
				'Text-to-speech: browser, AWS Polly, Google, or a custom server',
				'Calculators: Desmos, GeoGebra, or the keyless Cortex',
				'Sign-language video',
				'Learner profiles that grant and withdraw tools'
			]
		}
	];

	const guides = [
		{
			name: 'Getting started',
			href: `${docs}docs/getting-started.md`,
			summary: 'Render one item, save the response and score it.'
		},
		{
			name: 'Architecture',
			href: `${docs}docs/architecture/architecture.md`,
			summary: 'How the players, the toolkit, the tools and the elements fit together.'
		},
		{
			name: 'Documentation',
			href: `${docs}docs/readme.md`,
			summary: 'Every guide, grouped by reader: integrating, extending and contributing.'
		}
	];
</script>

<svelte:head>
	<title>PIE Players</title>
	<meta
		name="description"
		content="Players, an assessment toolkit and accessibility tools for PIE assessment content, as custom elements that run in any web page."
	/>
</svelte:head>

<div class="container mx-auto px-4 py-12 max-w-7xl">
	<div class="mb-12">
		<h1 class="text-5xl font-bold text-secondary mb-4">PIE Players</h1>
		<p class="text-xl text-base-content/70 max-w-3xl">
			Players, an assessment toolkit and accessibility tools for PIE assessment content. Every
			player is a custom element, so it runs in any web page, with any framework or none.
		</p>
	</div>

	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Players</h2>
		<div class="prose max-w-none mb-8">
			<p class="text-lg">
				PIE elements are the question types and passages, published from
				<a href="https://github.com/pie-framework/pie-elements-ng" target="_blank" rel="noreferrer"
					>pie-elements-ng</a
				>. A player loads them, renders them and keeps their sessions.
			</p>
		</div>

		<div class="grid md:grid-cols-2 gap-6">
			{#each players as player (player.name)}
				<div class="card bg-base-100 shadow-xl border border-base-300">
					<div class="card-body">
						<h3 class="card-title text-primary">{player.name}</h3>
						<p class="text-xs font-mono text-base-content/60">{player.tag}</p>
						<p class="text-sm mb-3">{player.summary}</p>
						<ul class="text-xs space-y-1">
							{#each player.points as point (point)}
								<li>• {point}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Loading strategies</h2>
		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				The item player's <code>strategy</code> attribute decides where element code comes from.
				Every strategy defines the same versioned custom elements.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-6">
			{#each strategies as strategy (strategy.name)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<div class="flex items-center gap-3 mb-2">
							<h3 class="card-title font-mono">{strategy.name}</h3>
							{#if strategy.badge}
								<span class="badge badge-primary">{strategy.badge}</span>
							{/if}
						</div>
						<p class="text-sm mb-2">{strategy.summary}</p>
						<p class="text-xs text-base-content/70">{strategy.fit}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Assessment toolkit</h2>
		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				The toolkit holds what works across items: tool policy and placement, stacking,
				text-to-speech, highlights and accessibility catalogs.
				<code>&lt;pie-assessment-toolkit&gt;</code> creates a coordinator when the host supplies none.
			</p>
		</div>

		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each services as service (service.name)}
				<div class="card bg-base-100 border border-base-300">
					<div class="card-body">
						<h3 class="font-bold font-mono text-primary mb-2">{service.name}</h3>
						<p class="text-sm">{service.summary}</p>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Tools and accommodations</h2>
		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				Each tool is a package the toolkit places at item, passage or section level. The toolkit
				resolves its availability from placement, host policy, provider gates, the learner profile
				and custom policy sources, so every player shows the same tools to the same learner.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-6 mb-8">
			{#each toolGroups as group (group.name)}
				<div class="card bg-base-200">
					<div class="card-body">
						<h3 class="font-bold mb-2">{group.name}</h3>
						<ul class="text-sm space-y-1">
							{#each group.items as item (item)}
								<li>• {item}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/each}
		</div>

		<div class="card bg-success/10 border border-success/30">
			<div class="card-body">
				<h3 class="font-bold text-success text-lg mb-2">WCAG 2.2 AA baseline</h3>
				<p class="text-sm">
					The players, the toolkit and the tools target WCAG 2.2 Level AA: keyboard operation,
					screen reader support, contrast, target size and alternative content. The
					<a class="link" href={`${docs}docs/wcag/wcag-2.2-aa-baseline.md`} target="_blank" rel="noreferrer"
						>baseline</a
					>
					lists the criteria, and the
					<a class="link" href={`${docs}docs/wcag/deferred-issues.md`} target="_blank" rel="noreferrer"
						>deferred issues</a
					> list the confirmed gaps.
				</p>
			</div>
		</div>
	</section>

	<section class="mb-12">
		<h2 class="text-3xl font-bold text-secondary mb-6">Integration</h2>
		<div class="prose max-w-none mb-6">
			<p class="text-lg">
				A host drives a player through standard DOM APIs: properties for configuration, events for
				state changes, and methods for control.
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-6">
			<div class="card bg-base-200">
				<div class="card-body">
					<h3 class="font-bold text-primary mb-3">Properties</h3>
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
					<h3 class="font-bold text-primary mb-3">Events</h3>
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
					<h3 class="font-bold text-primary mb-3">Methods</h3>
					<div class="mockup-code text-xs">
						<pre><code>// Score in the browser
const outcome =
  await player
    .provideScore();

// Validate while authoring
const validation =
  await player
    .validateModels();</code></pre>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section>
		<h2 class="text-3xl font-bold text-secondary mb-6">Getting started</h2>

		<div class="grid md:grid-cols-3 gap-6">
			{#each guides as guide (guide.name)}
				<a
					href={guide.href}
					target="_blank"
					rel="noreferrer"
					class="card bg-base-100 shadow-xl border border-base-300 hover:shadow-2xl transition-shadow"
				>
					<div class="card-body">
						<h3 class="card-title text-primary">{guide.name}</h3>
						<p class="text-sm">{guide.summary}</p>
					</div>
				</a>
			{/each}
		</div>

		<div class="card bg-primary text-primary-content shadow-xl mt-8">
			<div class="card-body">
				<h3 class="card-title text-2xl mb-3">Install</h3>
				<pre class="mockup-code bg-base-100 text-base-content mt-3"><code>npm install @pie-players/pie-item-player</code></pre>
				<p class="text-sm mt-3">Or, without a build step:</p>
				<pre class="mockup-code bg-base-100 text-base-content mt-3"><code
						>&lt;script type="module"
  src="https://cdn.jsdelivr.net/npm/@pie-players/pie-item-player@x.y.z/dist/pie-item-player.js"&gt;&lt;/script&gt;
&lt;pie-item-player id="player"&gt;&lt;/pie-item-player&gt;</code
					></pre>
			</div>
		</div>
	</section>
</div>
