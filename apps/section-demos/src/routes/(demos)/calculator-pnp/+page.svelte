<script lang="ts">
	/*
	 * The toolkit without a section player: `<pie-assessment-toolkit>` wraps one
	 * item scope, which holds an item toolbar and an item player, and owns its
	 * coordinator. The scope gives the toolbar's tools the item and the region
	 * they act on, and registers the item's catalogs. The learner's profile
	 * decides whether the calculator shows and which flavor it opens in;
	 * changing the profile below rebinds `assessment`, and the toolbar follows
	 * without a reload.
	 */
	import '@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element';
	import '@pie-players/pie-assessment-toolkit/components/item-scope-element';
	import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
	import '@pie-players/pie-item-player';
	import type { ToolContextResolverMap } from '@pie-players/pie-assessment-toolkit';
	import type { AssessmentEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import { createSectionDemoToolRegistryForCalculator } from '#lib/demo-runtime/default-tool-registry.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type ProfileOption = 'none' | 'calculator' | 'graphing';
	const PROFILE_OPTIONS: { value: ProfileOption; label: string; supports: string[] }[] = [
		{ value: 'none', label: 'No calculator', supports: [] },
		{ value: 'calculator', label: 'calculator', supports: ['calculator'] },
		{
			value: 'graphing',
			label: 'calculator + graphingCalculator',
			supports: ['calculator', 'graphingCalculator']
		}
	];

	const item = $derived((data.section as any)?.assessmentItemRefs?.[0]?.item as ItemEntity);
	const toolRegistry = createSectionDemoToolRegistryForCalculator('cortex');
	const tools = {
		placement: { item: ['textToSpeech', 'calculator'] },
		providers: { calculator: { provider: { id: 'calculator-cortex' } } }
	};

	/*
	 * The host's rule, read from the profile at render time: a graphing grant opens
	 * the graphing calculator and keeps scientific one switch away, a calculator
	 * grant opens scientific only, and no grant hides the button. Resolvers re-run
	 * on every policy change, so a rebound profile re-derives all three.
	 */
	const toolContextResolvers: ToolContextResolverMap = {
		calculator: ({ toolbarContext }) => {
			const coordinator = toolbarContext.toolkitCoordinator;
			const granted = (featureId: string) =>
				coordinator?.decideFeaturePolicy?.(featureId).granted === true;
			if (granted('graphingCalculator')) {
				return {
					visible: true,
					params: { calculatorType: 'graphing', availableTypes: ['scientific', 'graphing'] }
				};
			}
			if (granted('calculator')) {
				return {
					visible: true,
					params: { calculatorType: 'scientific', availableTypes: ['scientific'] }
				};
			}
			return { visible: false, reason: 'The profile grants no calculator.' };
		}
	};

	let profile = $state<ProfileOption>('calculator');
	const assessment = $derived<AssessmentEntity>({
		id: 'section-demos.calculator-pnp',
		name: 'Calculator by profile',
		personalNeedsProfile: {
			supports: PROFILE_OPTIONS.find((option) => option.value === profile)?.supports ?? []
		}
	} as AssessmentEntity);

	const playerConfig = withDemoLoaderOptions<{ loaderOptions?: Record<string, unknown> }>({});
	const env = { mode: 'gather', role: 'student' };
	const session = { id: 'calculator-pnp-session', data: [] };
</script>

<svelte:head>
	<title>{data.demo?.name || 'Calculator by Profile'} - PIE Section Demos</title>
</svelte:head>

<main class="calculator-pnp-page">
	<h1>{data.demo?.name || 'Calculator by Profile'}</h1>
	<p>{data.demo?.description}</p>

	<fieldset class="calculator-pnp-profile" data-testid="calculator-pnp-profile">
		<legend>Profile <code>supports</code></legend>
		{#each PROFILE_OPTIONS as option (option.value)}
			<label>
				<input
					type="radio"
					name="calculator-pnp-profile"
					value={option.value}
					bind:group={profile}
				/>
				{option.label}
			</label>
		{/each}
	</fieldset>

	<pie-assessment-toolkit
		assessment-id={assessment.id}
		pnp-enforcement="on"
		{assessment}
		{tools}
		{toolRegistry}
		{toolContextResolvers}
	>
		<pie-item-scope item-id={item.id} {item}>
			<article class="calculator-pnp-item" data-testid="calculator-pnp-item">
				<header class="calculator-pnp-item-header">
					<h2>{item.name}</h2>
					<pie-item-toolbar></pie-item-toolbar>
				</header>
				<div data-region="content">
					<pie-item-player
						config={item.config}
						{env}
						{session}
						loaderOptions={playerConfig.loaderOptions}
					></pie-item-player>
				</div>
			</article>
		</pie-item-scope>
	</pie-assessment-toolkit>
</main>

<style>
	.calculator-pnp-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.calculator-pnp-profile {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		padding: 0.75rem 1rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		border-radius: 0.5rem;
	}

	.calculator-pnp-item {
		padding: 1rem;
		border-radius: 0.75rem;
		background: var(--color-base-100);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.calculator-pnp-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.calculator-pnp-item-header h2 {
		margin: 0;
		font-size: 1.125rem;
	}
</style>
