<script lang="ts">
	import McPopulatedBlank from '@pie-element/mc-populated-blank/browser/delivery';
	import * as mcPopulatedBlankController from '@pie-element/mc-populated-blank/browser/controller';
	import { createToolsConfig, ToolkitCoordinator } from '@pie-players/pie-assessment-toolkit';
	import { createUniversalPersonalNeedsProfile } from '@pie-players/pie-default-tool-loaders';
	import { registerPreloadedElements } from '@pie-players/pie-item-player/preloaded';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import {
		MC_POPULATED_BLANK_PACKAGE,
		MC_POPULATED_BLANK_VERSION
	} from '$lib/content/demo-preloaded-bundled-elements';
	import {
		bindDemoAssessment,
		DEMO_ASSESSMENT_ID,
		getOrCreateAttemptId,
		getUrlEnumParam,
		LAYOUT_OPTIONS,
		MODE_OPTIONS
	} from '$lib/demo-runtime/demo-page-helpers';
	import { withDemoLoaderOptions } from '$lib/demo-runtime/demo-player-config';
	import { createSectionDemoToolRegistry } from '$lib/demo-runtime/default-tool-registry';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The host's bundler resolved the element and its controller, so the
	// preloaded player loads nothing; the controller is the `model()` a player
	// that is not hosted runs.
	let registrationError = $state<string | null>(null);
	try {
		registerPreloadedElements([
			{
				tag: 'mc-populated-blank',
				package: MC_POPULATED_BLANK_PACKAGE,
				version: MC_POPULATED_BLANK_VERSION,
				element: McPopulatedBlank,
				controller: mcPopulatedBlankController
			}
		]);
	} catch (error) {
		registrationError = error instanceof Error ? error.message : String(error);
	}

	const toolRegistry = createSectionDemoToolRegistry();
	const toolkitToolsConfig = createToolsConfig({
		source: 'section-demos.preloaded-bundled-elements',
		strictness: 'error',
		toolRegistry,
		tools: { placement: { section: [], item: [], passage: [] } }
	}).config;
	const coordinator = new ToolkitCoordinator({
		assessmentId: DEMO_ASSESSMENT_ID,
		toolRegistry,
		toolConfigStrictness: 'error',
		tools: toolkitToolsConfig
	});
	const sectionPlayerConfig = withDemoLoaderOptions({});

	const roleType = getUrlEnumParam('mode', MODE_OPTIONS, 'candidate');
	const layoutType = getUrlEnumParam('layout', LAYOUT_OPTIONS, 'splitpane');
	const attemptId = getOrCreateAttemptId();
	const pieEnv = {
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	} as const;

	let section = $derived(
		data.section && {
			...data.section,
			personalNeedsProfile: createUniversalPersonalNeedsProfile()
		}
	);
	$effect(() => {
		bindDemoAssessment(coordinator, section as any);
	});
	let runtime = $derived({
		playerType: 'preloaded',
		lazyInit: true,
		tools: toolkitToolsConfig,
		player: sectionPlayerConfig,
		env: pieEnv,
		coordinator
	});
</script>

<svelte:head>
	<title>{data.demo?.name || 'Preloaded Bundled Elements'} - Section Demos</title>
</svelte:head>

<div class="preloaded-bundled-elements-demo">
	{#if registrationError}
		<p class="preload-status error" role="alert">{registrationError}</p>
	{:else if layoutType === 'vertical'}
		<pie-section-player-vertical
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={section?.identifier}
			attempt-id={attemptId}
			{runtime}
			{section}
			{toolRegistry}
			show-toolbar={false}
		></pie-section-player-vertical>
	{:else}
		<pie-section-player-splitpane
			assessment-id={DEMO_ASSESSMENT_ID}
			section-id={section?.identifier}
			attempt-id={attemptId}
			{runtime}
			{section}
			{toolRegistry}
			show-toolbar={false}
		></pie-section-player-splitpane>
	{/if}
</div>

<style>
	.preloaded-bundled-elements-demo {
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

	.preload-status {
		margin: 1rem;
	}
</style>
