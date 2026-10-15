<script lang="ts">
	/**
	 * Demo: magnifier.
	 *
	 * `?page=` switches between a profile that grants `magnification` at a starting
	 * zoom of 2.5 and one that prohibits it, which withdraws the placed magnifier
	 * from the toolbar.
	 *
	 * A bespoke page rather than the shared demo runtime because the profile is
	 * host-owned: policy takes it from a bound `AssessmentEntity`, so the host binds
	 * one here with `ToolkitCoordinator.updateAssessment(...)`, as the sign-language
	 * demo does. The magnifier is in the packaged capability set, so the registry
	 * needs no registration.
	 */
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import type { ToolkitCoordinatorApi } from '@pie-players/pie-assessment-toolkit';
	import { createPackagedToolRegistry } from '@pie-players/pie-default-tool-loaders';
	import type {
		AssessmentEntity,
		PersonalNeedsProfile
	} from '@pie-players/pie-players-shared/types';
	import { demoMagnifierProfiles } from '#lib/content/demo-magnifier.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const toolRegistry = createPackagedToolRegistry();

	const toolkitToolsConfig = {
		placement: {
			section: ['theme', 'magnification'],
			item: [],
			passage: []
		}
	};

	const activeSection = $derived(data.section as any);
	const sectionId = $derived(String(activeSection?.identifier || 'magnifier-granted'));
	const attemptId = $derived(`magnifier-attempt-${data.activeDemoPageId || 'default'}`);
	const profile = $derived<PersonalNeedsProfile>(
		demoMagnifierProfiles[sectionId] ?? { supports: [] }
	);
	const assessmentEntity = $derived({
		id: `section-demos.magnifier.${data.activeDemoPageId || 'default'}`,
		name: 'Magnifier demo assessment',
		personalNeedsProfile: profile
	} as AssessmentEntity);

	let toolkitCoordinator = $state<ToolkitCoordinatorApi | null>(null);
	let decisionText = $state<string>('pending');

	function refreshDecision() {
		const coord = toolkitCoordinator;
		if (!coord || typeof coord.decideFeaturePolicy !== 'function') return;
		const decision = coord.decideFeaturePolicy('magnification');
		const zoom = (decision.parameters as { zoom?: number } | undefined)?.zoom;
		decisionText = `${decision.granted ? 'granted' : 'not granted'}${
			zoom === undefined ? '' : `, zoom ${zoom}`
		} — ${decision.reason}`;
	}

	function handleToolkitReady(event: Event) {
		const detail = (event as CustomEvent<{ coordinator?: ToolkitCoordinatorApi }>).detail;
		const coord = detail?.coordinator ?? null;
		toolkitCoordinator = coord;
		if (!coord) return;
		coord.updateAssessment(assessmentEntity);
		coord.onPolicyChange(() => refreshDecision());
		refreshDecision();
	}

	// Re-bind when `?page=` swaps the active section (and with it the profile).
	$effect(() => {
		const coord = toolkitCoordinator;
		const entity = assessmentEntity;
		if (!coord) return;
		coord.updateAssessment(entity);
		refreshDecision();
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Magnifier'} - PIE Section Demos</title>
</svelte:head>

<main class="magnifier-page">
	<section class="magnifier-card">
		<h1>{data.demo?.name || 'Magnifier'}</h1>
		<p>{data.demo?.description || ''}</p>

		<nav class="magnifier-pages" aria-label="Profiles">
			{#each data.demoPages as demoPage (demoPage.id)}
				<a
					class:active={demoPage.id === data.activeDemoPageId}
					href={`?page=${demoPage.id}`}
					aria-current={demoPage.id === data.activeDemoPageId ? 'page' : undefined}
				>
					{demoPage.name}
				</a>
			{/each}
		</nav>

		<div class="policy-snapshot" data-testid="magnifier-policy-snapshot">
			<div>
				<code>magnification</code> feature decision:
				<strong data-testid="magnifier-decision">{decisionText}</strong>
			</div>
			<p class="policy-snapshot-help">
				Open the magnifier from the section toolbar and move it over the passage. Arrow
				keys move the lens, <kbd>+</kbd> and <kbd>-</kbd> zoom, the corner grip resizes
				it, and <kbd>Esc</kbd> closes it.
			</p>
		</div>

		<pie-section-player-splitpane
			runtime={{ assessmentId: assessmentEntity.id, tools: toolkitToolsConfig }}
			{toolRegistry}
			{sectionId}
			{attemptId}
			section={data.section}
			show-toolbar={true}
			data-testid="magnifier-player"
			ontoolkit-ready={handleToolkitReady}
		></pie-section-player-splitpane>
	</section>
</main>

<style>
	.magnifier-page {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
		gap: 1rem;
	}

	.magnifier-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
		min-height: 0;
		background: var(--color-base-100);
		border-radius: 0.75rem;
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.magnifier-pages {
		display: flex;
		gap: 0.5rem;
	}

	.magnifier-pages a {
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
		text-decoration: none;
	}

	.magnifier-pages a.active {
		background: color-mix(in srgb, currentColor 12%, transparent);
		font-weight: 600;
	}

	.policy-snapshot {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		background: color-mix(in srgb, currentColor 6%, transparent);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.policy-snapshot-help {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		opacity: 0.85;
	}

	:global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}
</style>
