<script lang="ts">
	import { browser } from '$app/environment';
	import {
		createDefaultPersonalNeedsProfile,
		createToolsConfig,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';
	import {
		BundleType,
		CompositeInstrumentationProvider,
		DebugPanelInstrumentationProvider,
		NewRelicInstrumentationProvider,
		Status
	} from '@pie-players/pie-players-shared';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import {
		DEMO_ASSESSMENT_ID,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS
	} from '$lib/demo-runtime/demo-page-helpers';
	import { createSectionDemoToolRegistry } from '$lib/demo-runtime/default-tool-registry';
	import type { PageData } from './$types';

	const FIXTURE_TAG = 'metadata-session-fixture';
	const FIXTURE_VERSIONED_TAG = 'metadata-session-fixture--version-1-0-0';
	const ITEM_ID = 'metadata-session-item';
	const MODEL_ID = 'metadata-choice';

	let { data }: { data: PageData } = $props();
	const toolRegistry = createSectionDemoToolRegistry();
	const toolsConfigResult = createToolsConfig({
		source: 'section-demos.metadata-session-forwarding',
		strictness: 'error',
		toolRegistry,
		tools: {
			placement: {
				section: [],
				item: [],
				passage: []
			}
		}
	});
	if (toolsConfigResult.diagnostics.length > 0) {
		console.warn(
			'[metadata-session-forwarding demo] tools config diagnostics:',
			toolsConfigResult.diagnostics
		);
	}
	const toolkitToolsConfig = toolsConfigResult.config;
	const sectionInstrumentationProvider = new CompositeInstrumentationProvider([
		new NewRelicInstrumentationProvider(),
		new DebugPanelInstrumentationProvider()
	]);
	void sectionInstrumentationProvider
		.initialize()
		.then(() => {
			sectionInstrumentationProvider.trackMetric('demo.instrumentation.bootstrap', 1, {
				app: 'section-demos',
				demo: 'metadata-session-forwarding',
				category: 'demo'
			});
		})
		.catch(() => {});
	const sectionPlayerConfig = {
		loaderConfig: {
			trackPageActions: true,
			instrumentationProvider: sectionInstrumentationProvider
		}
	};
	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		toolRegistry,
		toolConfigStrictness: 'error',
		tools: toolkitToolsConfig
	});

	let fixtureRegistered = $state(false);
	const selectedPlayerType = 'preloaded';
	let roleType = $state<'candidate' | 'scorer'>(getUrlEnumParam('mode', MODE_OPTIONS, 'candidate'));
	let layoutType = $state<'splitpane' | 'vertical'>(
		getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane')
	);
	let attemptId = $state(getOrCreateAttemptId());

	let resolvedSectionForPlayer = $derived.by(() => {
		const section = data.section as any;
		if (!section) return section;
		const hasExplicitPnp = Boolean(
			section?.personalNeedsProfile || section?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return section;
		return {
			...section,
			personalNeedsProfile: createDefaultPersonalNeedsProfile()
		};
	});
	let sessionPanelSectionId = $derived(
		String(
			(resolvedSectionForPlayer as any)?.identifier ||
				`section-${String((data?.demo as any)?.id || 'metadata-session-forwarding')}`
		)
	);
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});

	coordinator.setHooks({
		onFrameworkError: (model) => {
			console.error('[metadata-session-forwarding demo] Toolkit framework error:', model);
		}
	} satisfies ToolkitCoordinatorHooks);

	function createFixtureElementClass() {
		return class MetadataSessionFixtureElement extends HTMLElement {
			connectedCallback() {
				if (this.dataset.fixtureReady === 'true') return;
				this.dataset.fixtureReady = 'true';
				this.innerHTML = `
					<div class="metadata-session-fixture">
						<p>Metadata session forwarding fixture</p>
						<button type="button" data-seed-response>Seed response</button>
						<button type="button" data-emit-metadata>Emit metadata echo</button>
					</div>
				`;
				this.querySelector('[data-seed-response]')?.addEventListener('click', () => {
					this.closest('pie-item-player')?.dispatchEvent(
						new CustomEvent('session-changed', {
							bubbles: true,
							composed: true,
							detail: {
								session: {
									id: ITEM_ID,
									data: [
										{
											id: MODEL_ID,
											element: FIXTURE_VERSIONED_TAG,
											value: ['A']
										}
									]
								},
								component: FIXTURE_VERSIONED_TAG,
								complete: false
							}
						})
					);
				});
				this.querySelector('[data-emit-metadata]')?.addEventListener('click', () => {
					this.dispatchEvent(
						new CustomEvent('session-changed', {
							bubbles: true,
							composed: true,
							detail: {
								session: {
									id: ITEM_ID,
									data: [{ id: MODEL_ID, element: FIXTURE_VERSIONED_TAG }]
								},
								component: FIXTURE_VERSIONED_TAG,
								complete: true
							}
						})
					);
				});
			}
		};
	}

	function registerFixtureRegistryEntry(tagName: string) {
		const runtimeWindow = window as unknown as {
			PIE_REGISTRY?: Record<string, Record<string, unknown>>;
		};
		const registry = (runtimeWindow.PIE_REGISTRY ||= {});
		registry[tagName] ||= {
			package: '@pie-players/metadata-session-fixture@1.0.0',
			status: Status.loaded,
			tagName,
			bundleType: BundleType.player
		};
	}

	$effect(() => {
		if (!browser) return;
		if (!customElements.get(FIXTURE_TAG)) {
			customElements.define(FIXTURE_TAG, createFixtureElementClass());
		}
		if (!customElements.get(FIXTURE_VERSIONED_TAG)) {
			customElements.define(FIXTURE_VERSIONED_TAG, createFixtureElementClass());
		}
		registerFixtureRegistryEntry(FIXTURE_TAG);
		registerFixtureRegistryEntry(FIXTURE_VERSIONED_TAG);
		fixtureRegistered = true;
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Metadata Session Forwarding'} - Section Demos</title>
</svelte:head>

<div class="metadata-session-forwarding-demo">
	{#if !fixtureRegistered}
		<p class="fixture-readiness" role="status">Registering metadata session fixture...</p>
	{:else if layoutType === 'vertical'}
		<pie-section-player-vertical
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			runtime={ {
				playerType: selectedPlayerType,
				lazyInit: true,
				tools: toolkitToolsConfig,
				player: sectionPlayerConfig,
				env: pieEnv,
				coordinator: coordinator
			} }
			section={resolvedSectionForPlayer}
			{toolRegistry}
			show-toolbar={false}
		></pie-section-player-vertical>
	{:else}
		<pie-section-player-splitpane
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={sessionPanelSectionId}
			attempt-id={attemptId}
			runtime={ {
				playerType: selectedPlayerType,
				lazyInit: true,
				tools: toolkitToolsConfig,
				player: sectionPlayerConfig,
				env: pieEnv,
				coordinator: coordinator
			} }
			section={resolvedSectionForPlayer}
			{toolRegistry}
			show-toolbar={false}
		></pie-section-player-splitpane>
	{/if}
</div>

<style>
	.metadata-session-forwarding-demo {
		display: flex;
		min-height: 100vh;
		background: var(--pie-background-dark, #ecedf1);
	}

	:global(pie-section-player-splitpane),
	:global(pie-section-player-vertical) {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.fixture-readiness {
		margin: 1rem;
	}

	:global(.metadata-session-fixture) {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
	}

	:global(.metadata-session-fixture button) {
		width: fit-content;
	}
</style>
