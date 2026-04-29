<script lang="ts">
	/**
	 * Demo: QTI default-on (M8 PR 4 smoke fixture).
	 *
	 * The host never sets the `qti-enforcement` attribute. Instead it
	 * binds an `AssessmentEntity` that carries QTI material via
	 * `ToolkitCoordinator.updateAssessment(...)`. The coordinator's
	 * narrow auto-on rule (see
	 * `packages/assessment-toolkit/src/policy/core/qti-inputs.ts`)
	 * flips `qtiEnforcement` to `'on'` without any extra wiring.
	 *
	 * The page reads back `coord.getPolicyInputs().qtiEnforcement` and
	 * the engine decision so the resolved mode is observable from the
	 * DOM, both for humans browsing the demo and for any automated
	 * smoke fixture that wants to assert the auto-default chain.
	 */
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-tool-graph';
	import '@pie-players/pie-tool-text-to-speech';
	import '@pie-players/pie-tool-theme';
	import type { ToolkitCoordinatorApi } from '@pie-players/pie-assessment-toolkit';
	import type { AssessmentEntity } from '@pie-players/pie-players-shared/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const toolkitToolsConfig = {
		placement: {
			section: ['theme', 'graph'],
			item: ['textToSpeech'],
			passage: [],
		},
	};

	// QTI material: PNP supports + district requirement. Either one
	// alone is enough to flip the auto-on rule; both are present so
	// the demo also exercises `alwaysAvailable` (PNP support) and
	// `required` (district `requiredTools`) in one decision.
	const assessmentEntity: AssessmentEntity = {
		id: 'section-demos.qti-default-on',
		name: 'QTI default-on assessment',
		personalNeedsProfile: { supports: ['graph'] },
		settings: {
			districtPolicy: { requiredTools: ['graph'] },
		},
	} as AssessmentEntity;

	const sectionId = $derived(
		String((data.section as any)?.identifier || 'qti-default-on-section'),
	);
	const attemptId = 'qti-default-on-attempt';

	let toolkitCoordinator = $state<ToolkitCoordinatorApi | null>(null);
	let resolvedQtiEnforcement = $state<'on' | 'off' | 'pending'>('pending');
	let sectionDecisionVisibleTools = $state<string[]>([]);

	function refreshPolicySnapshot() {
		const coord = toolkitCoordinator;
		if (!coord) return;
		try {
			resolvedQtiEnforcement = coord.getPolicyInputs().qtiEnforcement;
			const decision = coord.decideToolPolicy({
				level: 'section',
				scope: { level: 'section', scopeId: sectionId },
			});
			sectionDecisionVisibleTools = decision.visibleTools.map(
				(entry) => `${entry.toolId}${entry.alwaysAvailable ? ' (alwaysAvailable)' : ''}${entry.required ? ' (required)' : ''}`,
			);
		} catch (error) {
			console.warn('[qti-default-on demo] policy snapshot failed:', error);
		}
	}

	function handleToolkitReady(event: Event) {
		const detail = (event as CustomEvent<{ coordinator?: ToolkitCoordinatorApi }>)
			.detail;
		const coord = detail?.coordinator ?? null;
		toolkitCoordinator = coord;
		if (!coord) return;
		// Bind the QTI-bearing assessment. With no `qti-enforcement`
		// attribute set on the layout CE, the coordinator's auto-on
		// rule is what resolves `qtiEnforcement` to 'on' here.
		coord.updateAssessment(assessmentEntity);
		coord.onPolicyChange(() => refreshPolicySnapshot());
		refreshPolicySnapshot();
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'QTI Default On'} - PIE Section Demos</title>
</svelte:head>

<main class="qti-default-on-page">
	<section class="qti-default-on-card">
		<h1>{data.demo?.name || 'QTI Default On (Auto-detect)'}</h1>
		<p>{data.demo?.description || 'M8 PR 4 narrow auto-on rule.'}</p>

		<div class="policy-snapshot" data-testid="qti-default-on-policy-snapshot">
			<div>
				resolved <code>qtiEnforcement</code>:
				<strong data-testid="qti-default-on-resolved-mode">{resolvedQtiEnforcement}</strong>
			</div>
			<div>
				section visible tools:
				<code data-testid="qti-default-on-section-visible-tools"
					>{sectionDecisionVisibleTools.join(', ') || 'pending'}</code
				>
			</div>
			<p class="policy-snapshot-help">
				Expected: <code>qtiEnforcement = "on"</code> as soon as the
				toolkit binds the assessment, even though no
				<code>qti-enforcement</code> attribute is set on the player.
			</p>
		</div>

		<pie-section-player-splitpane
			assessment-id={assessmentEntity.id}
			{sectionId}
			{attemptId}
			section={data.section}
			tools={toolkitToolsConfig}
			show-toolbar={true}
			data-testid="qti-default-on-player"
			ontoolkit-ready={handleToolkitReady}
		></pie-section-player-splitpane>
	</section>
</main>

<style>
	.qti-default-on-page {
		height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
		gap: 1rem;
	}

	.qti-default-on-card {
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
