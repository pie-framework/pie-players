<script lang="ts">
	/*
	 * The token is applied on the pie-section-player-splitpane element, which is
	 * where at least one real host sets its theme tokens. The value travels as a
	 * --demo-* custom property on <html> so the rule keeps applying to a freshly
	 * rendered player instance.
	 */
	import { untrack } from 'svelte';
	import SectionDemoRuntimePage from '$lib/demo-runtime/components/SectionDemoRuntimePage.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type HeaderFill = {
		id: 'light' | 'dark';
		token: string;
		attribute: string;
		variable: string;
		hint: string;
	};

	const fills: HeaderFill[] = [
		{
			id: 'light',
			token: '--pie-section-player-card-header-background',
			attribute: 'demoCardHeader',
			variable: '--demo-card-header',
			hint: 'both themes, unless the dark hook below is set'
		},
		{
			id: 'dark',
			token: '--pie-section-player-card-header-background-dark',
			attribute: 'demoCardHeaderDark',
			variable: '--demo-card-header-dark',
			hint: 'dark theme only — switch the theme in the toolbar to see it'
		}
	];

	let enabled = $state({ light: false, dark: false });
	let colors = $state({ light: '#c9e5e6', dark: '#1f4a4d' });
	let panelOpen = $state(true);

	$effect(() => {
		const root = document.documentElement;

		for (const fill of fills) {
			root.style.setProperty(fill.variable, colors[fill.id]);
			if (enabled[fill.id]) {
				root.dataset[fill.attribute] = 'on';
			} else {
				delete root.dataset[fill.attribute];
			}
		}

		return () => {
			untrack(() => {
				for (const fill of fills) {
					root.style.removeProperty(fill.variable);
					delete root.dataset[fill.attribute];
				}
			});
		};
	});
</script>

<SectionDemoRuntimePage {data} />

{#if panelOpen}
	<aside class="pie-token-demo-panel">
		<div class="pie-token-demo-panel-head">
			<span class="pie-token-demo-panel-title">Card header fill</span>
			<button type="button" onclick={() => (panelOpen = false)}>Hide</button>
		</div>

		{#each fills as fill (fill.id)}
			<div class="pie-token-demo-row">
				<label>
					<input type="checkbox" bind:checked={enabled[fill.id]} />
					<code>{fill.token}</code>
				</label>
				<input
					type="color"
					aria-label={`Color for ${fill.token}`}
					bind:value={colors[fill.id]}
				/>
				<p>{fill.hint}</p>
			</div>
		{/each}
	</aside>
{:else}
	<button class="pie-token-demo-panel-reopen" type="button" onclick={() => (panelOpen = true)}>
		Header fill
	</button>
{/if}

<style>
	:global(html[data-demo-card-header] pie-section-player-splitpane) {
		--pie-section-player-card-header-background: var(--demo-card-header);
	}

	:global(html[data-demo-card-header-dark] pie-section-player-splitpane) {
		--pie-section-player-card-header-background-dark: var(--demo-card-header-dark);
	}

	.pie-token-demo-panel {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		z-index: 9999;
		width: 22rem;
		max-width: calc(100vw - 2rem);
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.75rem;
		border: 1px solid rgba(0, 0, 0, 0.15);
		border-radius: 0.375rem;
		background: #ffffff;
		color: #1a1f27;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	.pie-token-demo-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.pie-token-demo-panel-title {
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.pie-token-demo-row {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 0.15rem 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
	}

	.pie-token-demo-row p {
		grid-column: 1 / -1;
		margin: 0;
		color: #4d5665;
	}

	.pie-token-demo-row label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.pie-token-demo-panel code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
	}

	.pie-token-demo-row input[type='color'] {
		width: 2.25rem;
		height: 1.5rem;
		padding: 0;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 0.2rem;
		background: none;
		cursor: pointer;
	}

	.pie-token-demo-panel button,
	.pie-token-demo-panel-reopen {
		padding: 0.2rem 0.45rem;
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 0.25rem;
		background: #f4f6f9;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pie-token-demo-panel-reopen {
		position: fixed;
		bottom: 1rem;
		left: 1rem;
		z-index: 9999;
		font-size: 0.75rem;
		background: #ffffff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
	}
</style>
