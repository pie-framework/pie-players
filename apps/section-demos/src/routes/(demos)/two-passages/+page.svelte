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

	const TOKEN = '--pie-section-player-card-header-background';

	let enabled = $state(false);
	let color = $state('#c9e5e6');
	let panelOpen = $state(true);

	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--demo-card-header', color);
		if (enabled) {
			root.dataset.demoCardHeader = 'on';
		} else {
			delete root.dataset.demoCardHeader;
		}

		return () => {
			untrack(() => {
				root.style.removeProperty('--demo-card-header');
				delete root.dataset.demoCardHeader;
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

		<div class="pie-token-demo-row">
			<label>
				<input type="checkbox" bind:checked={enabled} />
				<code>{TOKEN}</code>
			</label>
			<input type="color" aria-label={`Color for ${TOKEN}`} bind:value={color} />
		</div>
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
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid rgba(0, 0, 0, 0.08);
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
