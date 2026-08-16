<script lang="ts">
	/**
	 * Demo: dictionary and picture dictionary.
	 *
	 * Both are granted accommodations rather than universal supports, so the page binds
	 * an assessment whose PNP names them. Neither ships an endpoint — the corpus behind
	 * a dictionary is licensed per programme — so the page supplies one per tool through
	 * `runtime.toolContextResolvers`, which is the same seam a real host uses.
	 *
	 * The endpoints are stubs in this app with a fixed corpus. `photosynthesis`,
	 * `evidence`, `reason` and `current` have entries; `apple`, `sun`, `leaf` and `water`
	 * have pictures; anything else is a miss, and the reserved word `servicefailure`
	 * makes the stub answer 503 so the error state is reachable without stopping the
	 * server.
	 */
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-tool-dictionary';
	import '@pie-players/pie-tool-picture-dictionary';
	// The selection door. The annotation strip is the gateway that offers a lookup on
	// the learner's current selection; the composition layer pairs the two, so this
	// page only has to make the strip available.
	import '@pie-players/pie-tool-annotation-toolbar';
	import { createUniversalPersonalNeedsProfile } from '@pie-players/pie-default-tool-loaders';
	import type { ToolkitCoordinatorApi } from '@pie-players/pie-assessment-toolkit';
	import type { AssessmentEntity } from '@pie-players/pie-players-shared/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DICTIONARY_ENDPOINT = '/api/tools/dictionary';
	const PICTURE_DICTIONARY_ENDPOINT = '/api/tools/picture-dictionary';

	const runtime = {
		tools: {
			placement: {
				section: ['dictionary', 'pictureDictionary'],
				item: ['annotationToolbar'],
				passage: ['annotationToolbar'],
			},
		},
		// The documented seam for per-tool params. A resolver returning `params.endpoint`
		// is what turns the panel from its unconfigured state into a working lookup.
		toolContextResolvers: {
			dictionary: () => ({
				visible: true,
				params: { endpoint: DICTIONARY_ENDPOINT },
			}),
			pictureDictionary: () => ({
				visible: true,
				params: { endpoint: PICTURE_DICTIONARY_ENDPOINT },
			}),
		},
	};

	// A dictionary is construct-relevant on a vocabulary item, so PIE grants neither
	// tool universally. The profile is what makes them available here, on top of the
	// universal preset — which is where the annotation strip comes from, and binding a
	// profile at all turns PNP enforcement on, so naming only the two accommodations
	// would deny every universal support including that strip.
	const assessmentEntity: AssessmentEntity = {
		id: 'section-demos.dictionary-tools',
		name: 'Dictionary tools assessment',
		personalNeedsProfile: {
			...createUniversalPersonalNeedsProfile(),
			supports: [
				...(createUniversalPersonalNeedsProfile().supports ?? []),
				'dictionary',
				'pictureDictionary',
			],
		},
	} as AssessmentEntity;

	const sectionId = $derived(
		String((data.section as any)?.identifier || 'dictionary-tools-section'),
	);
	const attemptId = 'dictionary-tools-attempt';

	function handleToolkitReady(event: Event) {
		const detail = (event as CustomEvent<{ coordinator?: ToolkitCoordinatorApi }>)
			.detail;
		detail?.coordinator?.updateAssessment(assessmentEntity);
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Dictionary Tools'} - PIE Section Demos</title>
</svelte:head>

<main class="pie-dictionary-demo-page">
	<section class="pie-dictionary-demo-card">
		<h1>{data.demo?.name || 'Dictionary and Picture Dictionary'}</h1>
		<p>{data.demo?.description || 'Host-supplied word and picture lookup.'}</p>

		<div class="pie-dictionary-demo-help">
			<p>
				Open either tool from the section toolbar, then type a word. The stub corpus
				answers <code>photosynthesis</code>, <code>evidence</code>,
				<code>reason</code> and <code>current</code> with definitions, and
				<code>apple</code>, <code>sun</code>, <code>leaf</code> and
				<code>water</code> with pictures. <code>servicefailure</code> returns 503 so
				the error state is reachable.
			</p>
			<p>
				Selecting a word in the passage also opens the annotation strip, which offers
				a lookup on the selection — the panel opens already answered.
			</p>
			<p>
				That is a shortcut, not the way in. The panel's own field is the keyboard
				route: a sighted keyboard-only learner cannot originate a text selection in
				non-editable content, so a selection-only dictionary would be unreachable for
				them.
			</p>
		</div>

		<pie-section-player-splitpane
			{runtime}
			assessment-id={assessmentEntity.id}
			{sectionId}
			{attemptId}
			section={data.section}
			show-toolbar={true}
			data-testid="dictionary-tools-player"
			ontoolkit-ready={handleToolkitReady}
		></pie-section-player-splitpane>
	</section>
</main>

<style>
	.pie-dictionary-demo-page {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
		gap: 1rem;
	}

	.pie-dictionary-demo-card {
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

	.pie-dictionary-demo-help {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		background: color-mix(in srgb, currentColor 6%, transparent);
		font-size: 0.875rem;
	}

	.pie-dictionary-demo-help p {
		margin: 0 0 0.5rem;
	}

	.pie-dictionary-demo-help p:last-child {
		margin-bottom: 0;
	}

	:global(pie-section-player-splitpane) {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
		background: var(--pie-background-dark, #ecedf1);
	}
</style>
