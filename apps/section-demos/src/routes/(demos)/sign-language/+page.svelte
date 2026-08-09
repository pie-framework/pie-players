<script lang="ts">
	/**
	 * Demo: sign language (ASL) region.
	 *
	 * Signed alternates render in the item card's `data-region="media"` slot when
	 * BOTH halves of availability hold: the item carries a matching
	 * `sign-language` catalog card, and policy grants the `signLanguage` PNP
	 * support. `?page=` switches between a profile that grants it and one that
	 * does not.
	 *
	 * This is a bespoke page rather than the shared demo runtime because
	 * eligibility is host-owned: a section's own `personalNeedsProfile` drives the
	 * PNP debugger panel and the section engine, but the *policy engine* takes its
	 * profile from a bound `AssessmentEntity`. So the host binds one here, reading
	 * the profile off the active section — the same
	 * `ToolkitCoordinator.updateAssessment(...)` wiring the pnp-default-on demo
	 * uses.
	 */
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-tool-text-to-speech';
	import '@pie-players/pie-tool-theme';
	import type { ToolkitCoordinatorApi } from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentEntity,
		PersonalNeedsProfile
	} from '@pie-players/pie-players-shared/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const toolkitToolsConfig = {
		placement: {
			section: ['theme'],
			item: ['textToSpeech'],
			passage: []
		}
	};

	const activeSection = $derived(data.section as any);
	const sectionId = $derived(
		String(activeSection?.identifier || 'sign-language-section')
	);
	const attemptId = $derived(`sign-language-attempt-${data.activeDemoPageId || 'default'}`);
	const sectionProfile = $derived(
		(activeSection?.personalNeedsProfile as PersonalNeedsProfile | undefined) ?? {
			supports: []
		}
	);
	// The policy engine reads its profile from a bound assessment, so lift the
	// fixture's section-level profile onto one rather than restating it here.
	const assessmentEntity = $derived({
		id: `section-demos.sign-language.${data.activeDemoPageId || 'default'}`,
		name: 'Sign language demo assessment',
		personalNeedsProfile: sectionProfile
	} as AssessmentEntity);

	let toolkitCoordinator = $state<ToolkitCoordinatorApi | null>(null);
	let signingDecision = $state<string>('pending');

	function refreshDecision() {
		const coord = toolkitCoordinator;
		if (!coord || typeof coord.decideFeaturePolicy !== 'function') return;
		const decision = coord.decideFeaturePolicy('signLanguage');
		signingDecision = `${decision.granted ? 'granted' : 'not granted'} — ${decision.reason}`;
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
	<title>{data.demo?.name || 'Sign Language (ASL) Region'} - PIE Section Demos</title>
</svelte:head>

<main class="sign-language-page">
	<section class="sign-language-card">
		<h1>{data.demo?.name || 'Sign Language (ASL) Region'}</h1>
		<p>{data.demo?.description || ''}</p>

		<nav class="sign-language-pages" aria-label="Profiles">
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

		<div class="policy-snapshot" data-testid="sign-language-policy-snapshot">
			<div>
				<code>signLanguage</code> feature decision:
				<strong data-testid="sign-language-decision">{signingDecision}</strong>
			</div>
			<p class="policy-snapshot-help">
				Question 1 authors its signing video inline; question 3 carries an authored
				catalog card; question 4 is verbatim importer output; question 2 has no signing
				content and must show no region even when signing is granted. The bundled clip
				is a real public-domain ASL recording, but it does not sign these prompts — see
				<code>static/demo-assets/sign-language/README.md</code>.
			</p>
		</div>

		<pie-section-player-splitpane
			runtime={{ tools: toolkitToolsConfig }}
			assessment-id={assessmentEntity.id}
			{sectionId}
			{attemptId}
			section={data.section}
			show-toolbar={true}
			data-testid="sign-language-player"
			ontoolkit-ready={handleToolkitReady}
		></pie-section-player-splitpane>
	</section>
</main>

<style>
	.sign-language-page {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
		gap: 1rem;
	}

	.sign-language-card {
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

	.sign-language-pages {
		display: flex;
		gap: 0.5rem;
	}

	.sign-language-pages a {
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
		text-decoration: none;
	}

	.sign-language-pages a.active {
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
