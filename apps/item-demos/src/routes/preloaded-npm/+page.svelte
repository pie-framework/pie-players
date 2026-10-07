<script lang="ts">
	import McPopulatedBlank from '@pie-element/mc-populated-blank/browser/delivery';
	import * as mcPopulatedBlankController from '@pie-element/mc-populated-blank/browser/controller';
	import mcPopulatedBlankManifest from '@pie-element/mc-populated-blank/package.json';
	import MultipleChoice from '@pie-element/multiple-choice/browser/delivery';
	import * as multipleChoiceController from '@pie-element/multiple-choice/browser/controller';
	import multipleChoiceManifest from '@pie-element/multiple-choice/package.json';
	import { DEMO_PRELOADED_OPTIONS } from '@pie-players/demo-ui/preloaded';
	import '@pie-players/pie-item-player';
	import { registerPreloadedElements } from '@pie-players/pie-item-player/preloaded';
	import SiteHeader from '#lib/components/SiteHeader.svelte';

	/**
	 * The item player's preloaded strategy as a host runs it: item-demos
	 * installs the pie-elements-ng packages, the bundler resolves their
	 * `./browser/delivery` and `./browser/controller` builds, and the page
	 * registers them before any player mounts, so the player loads no element
	 * code. The players are not hosted, so each registration carries the
	 * controller whose `model()` the player runs.
	 */
	const REGISTERED = {
		multipleChoice: {
			tag: 'pie-element-multiple-choice',
			package: '@pie-element/multiple-choice',
			version: multipleChoiceManifest.version
		},
		mcPopulatedBlank: {
			tag: 'mc-populated-blank',
			package: '@pie-element/mc-populated-blank',
			version: mcPopulatedBlankManifest.version
		}
	} as const;

	let registrationError = $state<string | null>(null);
	try {
		registerPreloadedElements([
			{
				...REGISTERED.multipleChoice,
				element: MultipleChoice,
				controller: multipleChoiceController
			},
			{
				...REGISTERED.mcPopulatedBlank,
				element: McPopulatedBlank,
				controller: mcPopulatedBlankController
			}
		], DEMO_PRELOADED_OPTIONS);
	} catch (error) {
		registrationError = error instanceof Error ? error.message : String(error);
	}

	type DemoItem = {
		id: string;
		heading: string;
		note: string;
		config: HTMLElementTagNameMap['pie-item-player']['config'];
	};

	const ITEMS: DemoItem[] = [
		{
			id: 'npm-multiple-choice',
			heading: 'Multiple choice',
			// Content written against the legacy line, under its own base tag.
			note: 'Authored as `multiple-choice` at 11.4.3; the player aligns it to the registration.',
			config: {
				id: 'npm-multiple-choice',
				markup: '<multiple-choice id="npm-multiple-choice-element"></multiple-choice>',
				elements: { 'multiple-choice': '@pie-element/multiple-choice@11.4.3' },
				models: [
					{
						id: 'npm-multiple-choice-element',
						element: 'multiple-choice',
						choiceMode: 'radio',
						choicePrefix: 'letters',
						prompt: '<p>Which is the largest planet in our solar system?</p>',
						promptEnabled: true,
						choices: [
							{ value: 'mercury', label: 'Mercury', correct: false },
							{ value: 'jupiter', label: 'Jupiter', correct: true },
							{ value: 'earth', label: 'Earth', correct: false },
							{ value: 'mars', label: 'Mars', correct: false }
						]
					}
				]
			}
		},
		{
			id: 'npm-mc-populated-blank',
			heading: 'Populated blank',
			note: 'Authored at the registered version.',
			config: {
				id: 'npm-mc-populated-blank',
				markup: '<mc-populated-blank id="npm-mc-populated-blank-element"></mc-populated-blank>',
				elements: {
					'mc-populated-blank': `${REGISTERED.mcPopulatedBlank.package}@${REGISTERED.mcPopulatedBlank.version}`
				},
				models: [
					{
						id: 'npm-mc-populated-blank-element',
						element: 'mc-populated-blank',
						prompt: '',
						promptEnabled: false,
						template: '<p>He will heat up the water in the {{blank}}.</p>',
						choiceMode: 'text',
						choices: [
							{ id: 'distractor_1', labelHtml: 'teapot' },
							{ id: 'distractor_2', labelHtml: 'flytrap' },
							{ id: 'distractor_3', labelHtml: 'coffee' },
							{ id: 'distractor_4', labelHtml: 'freezer' }
						],
						correctChoiceId: 'distractor_1',
						interactionMode: 'populate_blank',
						layoutProfile: 'inline_sentence',
						customType: 'sr-vic',
						choiceLayout: 'vertical'
					}
				]
			}
		}
	];

	let players = $state<Record<string, HTMLElementTagNameMap['pie-item-player']>>({});
	let sessions = $state<Record<string, unknown>>({});

	$effect(() => {
		for (const item of ITEMS) {
			const player = players[item.id];
			if (!player || player.config) continue;
			player.env = { mode: 'gather', role: 'student' };
			player.session = { id: `${item.id}-session`, data: [] };
			player.config = item.config;
			player.addEventListener('session-changed', (event) => {
				sessions[item.id] = (event as CustomEvent<{ session?: unknown }>).detail?.session;
			});
		}
	});
</script>

<svelte:head>
	<title>Preloaded npm elements - PIE Item Demos</title>
</svelte:head>

<SiteHeader title="Preloaded npm elements" subtitle="Item player, host-bundled elements" />

<main class="container mx-auto max-w-4xl px-4 py-8 space-y-6">
	<p class="text-base-content/70">
		Each element below comes from a pie-elements-ng package item-demos installs:
		{REGISTERED.multipleChoice.package}@{REGISTERED.multipleChoice.version} and
		{REGISTERED.mcPopulatedBlank.package}@{REGISTERED.mcPopulatedBlank.version}. The page
		registers them with <code>registerPreloadedElements</code>, and each
		<code>&lt;pie-item-player strategy="preloaded"&gt;</code> loads nothing.
	</p>

	{#if registrationError}
		<div class="alert alert-error" role="alert">Registration failed: {registrationError}</div>
	{:else}
		{#each ITEMS as item (item.id)}
			<section class="card bg-base-100 shadow-xl" data-item-id={item.id}>
				<div class="card-body gap-4">
					<h2 class="card-title">{item.heading}</h2>
					<p class="text-sm text-base-content/60">{item.note}</p>
					<pie-item-player bind:this={players[item.id]} strategy="preloaded"></pie-item-player>
					<pre class="text-xs bg-base-200 p-3 rounded" data-testid="session">{JSON.stringify(
							sessions[item.id] ?? null
						)}</pre>
				</div>
			</section>
		{/each}
	{/if}
</main>
