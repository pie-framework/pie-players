<script lang="ts">
	/*
	 * The answer eliminator on each path it takes choices from, with the toolkit
	 * composed around a scope per item and no section player. The profile grants
	 * `answerEliminator`, AfA's `answer-masking`; the strategy is a tool parameter in the assessment's
	 * settings, the toggle style the toolkit's `nds-icons`, and the mode the item
	 * players' `env`. Each control is mirrored in the URL, so a state can be
	 * linked: `?strategy=mask&nds=1&mode=evaluate`.
	 */
	import { browser } from '$app/env';
	import { afterNavigate, goto } from '$app/navigation';
	import '@pie-players/pie-theme';
	import '@pie-players/pie-assessment-toolkit/components/pie-assessment-toolkit-element';
	import '@pie-players/pie-assessment-toolkit/components/item-scope-element';
	import '@pie-players/pie-assessment-toolkit/components/item-toolbar-element';
	import '@pie-players/pie-item-player';
	import type { AssessmentEntity, ItemEntity } from '@pie-players/pie-players-shared/types';
	import { createSectionDemoToolRegistry } from '#lib/demo-runtime/default-tool-registry.js';
	import { withDemoLoaderOptions } from '#lib/demo-runtime/demo-player-config.js';
	import {
		applyDaisyTheme,
		DAISY_THEME_STORAGE_KEY,
		DEFAULT_DAISY_THEME,
		DEFAULT_PLAYER,
		getUrlEnumParam,
		PLAYER_OPTIONS
	} from '#lib/demo-runtime/demo-page-helpers.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const playerType = getUrlEnumParam('player', PLAYER_OPTIONS, DEFAULT_PLAYER);

	const STRATEGIES = [
		{ value: 'strikethrough', label: 'Strike through' },
		{ value: 'cross', label: 'Cross' },
		{ value: 'mask', label: 'Mask' }
	] as const;
	const MODES = [
		{ value: 'gather', label: 'Gather' },
		{ value: 'evaluate', label: 'Evaluate' }
	] as const;
	type Strategy = (typeof STRATEGIES)[number]['value'];
	type Mode = (typeof MODES)[number]['value'];

	let strategy = $state<Strategy>(
		getUrlEnumParam('strategy', STRATEGIES.map(({ value }) => value), 'strikethrough')
	);
	let mode = $state<Mode>(getUrlEnumParam('mode', MODES.map(({ value }) => value), 'gather'));
	let ndsIcons = $state(getUrlEnumParam('nds', ['0', '1'], '0') === '1');

	let routerReady = $state(false);
	afterNavigate(({ shallow, type }) => {
		if (shallow && type === 'goto') return;
		routerReady = true;
	});
	$effect(() => {
		if (!routerReady) return;
		const url = new URL(window.location.href);
		url.searchParams.set('strategy', strategy);
		url.searchParams.set('mode', mode);
		url.searchParams.set('nds', ndsIcons ? '1' : '0');
		if (url.href !== window.location.href) goto(url, { shallow: true, replace: true });
	});
	// The stored site theme, carried to `<pie-theme>` so the items' tokens follow
	// it; the root layout applies it on load only, before a client navigation here.
	$effect(() => {
		if (!browser) return;
		applyDaisyTheme(
			window.localStorage.getItem(DAISY_THEME_STORAGE_KEY) || DEFAULT_DAISY_THEME,
			() => {}
		);
	});

	const items = $derived(
		((data.section as any)?.assessmentItemRefs ?? []).map(
			(ref: { item: ItemEntity }) => ref.item
		) as ItemEntity[]
	);
	const toolRegistry = createSectionDemoToolRegistry();
	const tools = { pnpEnforcement: 'on', placement: { item: ['answerEliminator'] } } as const;
	const assessment = $derived<AssessmentEntity>({
		id: 'section-demos.answer-eliminator',
		name: 'Answer Eliminator',
		personalNeedsProfile: { supports: ['answerEliminator'] },
		settings: { toolParameters: { answerEliminator: { strategy } } }
	} as AssessmentEntity);

	const playerConfig = withDemoLoaderOptions<{ loaderOptions?: Record<string, unknown> }>({});
	const env = $derived({ mode, role: 'student' });
	// One session per item for the page's life, so a mode change keeps the answers.
	const sessions = new Map<string, { id: string; data: unknown[] }>();
	const sessionFor = (item: ItemEntity) => {
		const id = item.id ?? '';
		let session = sessions.get(id);
		if (!session) {
			session = { id: `${id}-session`, data: [] };
			sessions.set(id, session);
		}
		return session;
	};
</script>

<svelte:head>
	<title>{data.demo?.name || 'Answer Eliminator'} - PIE Section Demos</title>
</svelte:head>

<!-- svelte-ignore a11y_misplaced_scope -->
<pie-theme scope="document" theme="light">
	<main class="answer-eliminator-page">
		<h1>{data.demo?.name || 'Answer Eliminator'}</h1>
		<p>{data.demo?.description}</p>

		<div class="answer-eliminator-controls" data-testid="answer-eliminator-controls">
			<fieldset>
				<legend>Strategy</legend>
				{#each STRATEGIES as option (option.value)}
					<label>
						<input type="radio" name="answer-eliminator-strategy" value={option.value} bind:group={strategy} />
						{option.label}
					</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Mode</legend>
				{#each MODES as option (option.value)}
					<label>
						<input type="radio" name="answer-eliminator-mode" value={option.value} bind:group={mode} />
						{option.label}
					</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Toggle</legend>
				<label><input type="checkbox" bind:checked={ndsIcons} /> NDS icons</label>
			</fieldset>
		</div>

		<pie-assessment-toolkit
			assessment-id={assessment.id}
			{assessment}
			{tools}
			{toolRegistry}
			nds-icons={ndsIcons}
		>
			{#each items as item (item.id)}
				<pie-item-scope item-id={item.id} {item}>
					<article class="answer-eliminator-item" data-testid={item.id}>
						<header class="answer-eliminator-item-header">
							<h2>{item.name}</h2>
							<pie-item-toolbar></pie-item-toolbar>
						</header>
						<div data-region="content">
							<pie-item-player
								config={item.config}
								{env}
								session={sessionFor(item)}
								loaderOptions={playerConfig.loaderOptions}
								strategy={playerType}
							></pie-item-player>
						</div>
					</article>
				</pie-item-scope>
			{/each}
		</pie-assessment-toolkit>
	</main>
</pie-theme>

<style>
	.answer-eliminator-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		max-width: 60rem;
		margin: 0 auto;
		padding: 1.5rem 1rem;
	}

	.answer-eliminator-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.answer-eliminator-controls fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		padding: 0.75rem 1rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		border-radius: 0.5rem;
	}

	.answer-eliminator-item {
		padding: 1rem;
		border-radius: 0.75rem;
		background: var(--color-base-100);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.answer-eliminator-item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.answer-eliminator-item-header h2 {
		margin: 0;
		font-size: 1.125rem;
	}
</style>
