<script lang="ts">
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const rawToolsConfig = {
		providers: {
			annotationToolbar: {
				enabled: true
			}
		},
		placement: {
			// Intentional invalid nesting for deterministic host-format validation.
			// section must be an array of ids, but this uses an object shape by mistake.
			section: {
				tools: ['theme', 'graph']
			},
			item: ['calculator', 'textToSpeech', 'annotationToolbar'],
			passage: ['textToSpeech', 'annotationToolbar']
		}
	};
	const sectionId = $derived(
		String((data.section as any)?.identifier || 'invalid-tools-config-section')
	);
	const attemptId = 'invalid-tools-config-attempt';
	let frameworkErrorCount = $state(0);
	let lastFrameworkErrorMessage = $state('');
	let lastFrameworkErrorKind = $state('');
	let lastFrameworkErrorSource = $state('');

	function handleFrameworkError(detail: Record<string, unknown>) {
		frameworkErrorCount += 1;
		const message = typeof detail.message === 'string' ? detail.message : String(detail.message || '');
		const kind = typeof detail.kind === 'string' ? detail.kind : '';
		const source = typeof detail.source === 'string' ? detail.source : '';
		lastFrameworkErrorMessage = message;
		lastFrameworkErrorKind = kind;
		lastFrameworkErrorSource = source;
	}

</script>

<svelte:head>
	<title>{data.demo?.name || 'Invalid Tools Config'} - PIE Section Demos</title>
</svelte:head>

<main class="invalid-config-page">
	<section class="invalid-config-card">
		<h1>{data.demo?.name || 'Invalid Tools Config (Error Surfacing)'}</h1>
		<p>{data.demo?.description || 'Intentional validation failure demo.'}</p>

		<div class="preload-status" data-testid="framework-error-events">
			<div>framework-error events received: <strong data-testid="framework-error-event-count">{frameworkErrorCount}</strong></div>
			{#if lastFrameworkErrorKind || lastFrameworkErrorSource}
				<div class="framework-error-meta" data-testid="framework-error-last-meta">
					last kind/source: <code>{lastFrameworkErrorKind || 'n/a'}</code> / <code>{lastFrameworkErrorSource || 'n/a'}</code>
				</div>
			{/if}
			{#if lastFrameworkErrorMessage}
				<pre data-testid="framework-error-last-message">{lastFrameworkErrorMessage}</pre>
			{/if}
		</div>

		<pie-section-player-splitpane
			assessment-id="section-demos.invalid-tools-config"
			{sectionId}
			{attemptId}
			section={data.section}
			tools={rawToolsConfig as any}
			frameworkErrorHook={handleFrameworkError}
			tool-config-strictness="error"
			show-toolbar={true}
			data-testid="invalid-tools-player"
		></pie-section-player-splitpane>
	</section>
</main>

<style>
	.invalid-config-page {
		height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 1.5rem;
		background: var(--pie-background-dark, #ecedf1);
	}

	.invalid-config-card {
		width: min(100%, 72rem);
		background: var(--color-base-100);
		border-radius: 0.75rem;
		padding: 1rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}

	.preload-status {
		margin-top: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		background: color-mix(in srgb, currentColor 6%, transparent);
	}

	.preload-status pre {
		margin: 0.5rem 0 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.framework-error-meta {
		margin-top: 0.5rem;
		font-size: 0.875rem;
	}
</style>
