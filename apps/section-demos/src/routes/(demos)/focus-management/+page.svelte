<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import type { AssessmentSection } from '@pie-players/pie-players-shared/types';
	import '@pie-players/pie-section-player/components/section-player-splitpane-element';
	import '@pie-players/pie-section-player/components/section-player-vertical-element';
	import '@pie-players/pie-section-player/components/section-player-tabbed-element';
	import type { PageData } from './$types';

	type FocusStrategy = 'start-of-content' | 'current-item' | 'none';
	type LayoutKind = 'splitpane' | 'vertical' | 'tabbed';

	const FOCUS_OPTIONS: FocusStrategy[] = ['start-of-content', 'current-item', 'none'];
	const LAYOUT_OPTIONS: LayoutKind[] = ['splitpane', 'vertical', 'tabbed'];

	let { data }: { data: PageData } = $props();

	function readParam<T extends string>(key: string, options: readonly T[], fallback: T): T {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		return value && options.includes(value as T) ? (value as T) : fallback;
	}

	function readBoolParam(key: string, fallback: boolean): boolean {
		if (!browser) return fallback;
		const value = new URLSearchParams(window.location.search).get(key);
		if (value === null) return fallback;
		return value !== 'off' && value !== '0' && value !== 'false';
	}

	let focusStrategy = $state<FocusStrategy>(readParam('focus', FOCUS_OPTIONS, 'start-of-content'));
	let layoutKind = $state<LayoutKind>(readParam('layout', LAYOUT_OPTIONS, 'splitpane'));
	let passageEnabled = $state<boolean>(readBoolParam('passage', true));

	// Remount the player whenever controls change so the fresh policy / section
	// takes effect — avoids reactive-policy plumbing for a demo.
	const playerKey = $derived(`${focusStrategy}:${layoutKind}:${passageEnabled ? 'p' : 'np'}`);

	const sectionWithPassage = $derived<AssessmentSection>(
		data.section as AssessmentSection
	);
	const sectionWithoutPassage = $derived<AssessmentSection>({
		...(data.section as AssessmentSection),
		identifier: `${(data.section as AssessmentSection).identifier}-no-passage`,
		rubricBlocks: []
	});
	const activeSection = $derived(
		passageEnabled ? sectionWithPassage : sectionWithoutPassage
	);

	const policies = $derived({
		readiness: { mode: 'progressive' as const },
		preload: { enabled: true },
		focus: { autoFocus: focusStrategy },
		telemetry: { enabled: true }
	});

	let layoutEl: HTMLElement | null = $state(null);
	let activeElementLabel = $state('(none)');

	function describeActiveElement(): string {
		if (!browser) return '(ssr)';
		const el = document.activeElement as HTMLElement | null;
		if (!el || el === document.body) return '(body)';
		const tag = el.tagName.toLowerCase();
		const id = el.id ? `#${el.id}` : '';
		const isCurrent = el.hasAttribute('is-current') ? '[is-current]' : '';
		return `${tag}${id}${isCurrent}`;
	}

	function refreshActiveElement(): void {
		activeElementLabel = describeActiveElement();
	}

	onMount(() => {
		const update = () => refreshActiveElement();
		document.addEventListener('focusin', update, true);
		document.addEventListener('focusout', update, true);
		update();
		return () => {
			document.removeEventListener('focusin', update, true);
			document.removeEventListener('focusout', update, true);
		};
	});

	function syncUrl(): void {
		if (!browser) return;
		const url = new URL(window.location.href);
		url.searchParams.set('focus', focusStrategy);
		url.searchParams.set('layout', layoutKind);
		url.searchParams.set('passage', passageEnabled ? 'on' : 'off');
		window.history.replaceState(null, '', url.toString());
	}

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		focusStrategy;
		layoutKind;
		passageEnabled;
		syncUrl();
	});

	let lastSkipResult = $state<string>('(not called)');

	function onSkipToMain(): void {
		const host = layoutEl as
			| (HTMLElement & { focusStart?: () => boolean })
			| null;
		if (!host) {
			lastSkipResult = 'layout element missing';
			return;
		}
		if (typeof host.focusStart !== 'function') {
			lastSkipResult =
				'focusStart() not defined on layout element — rebuild section-player (bun run --filter=@pie-players/pie-section-player build)';
			return;
		}
		// Move focus off the button before calling into the framework, so an
		// observer reads the true framework-landed target, not the button.
		(document.activeElement as HTMLElement | null)?.blur?.();
		const moved = host.focusStart();
		lastSkipResult = moved ? 'focusStart() → true' : 'focusStart() → false';
		queueMicrotask(refreshActiveElement);
	}

	function onNavigateNext(): void {
		const host = layoutEl as
			| (HTMLElement & { navigateNext?: () => boolean })
			| null;
		host?.navigateNext?.();
		// Framework defers composition emission behind a RAF before shifting
		// focus; re-read document.activeElement after that tick so the readout
		// reflects the landed target and not the just-clicked button.
		setTimeout(refreshActiveElement, 50);
	}

	function onNavigatePrevious(): void {
		const host = layoutEl as
			| (HTMLElement & { navigatePrevious?: () => boolean })
			| null;
		host?.navigatePrevious?.();
		setTimeout(refreshActiveElement, 50);
	}
</script>

<svelte:head>
	<title>Focus Management Demo - PIE Section Demos</title>
</svelte:head>

<main class="focus-demo-page">
	<header class="focus-demo-header">
		<!--
			Skip-to-Main is rendered first in DOM order so a keyboard user
			Tabs to it immediately, matching the real Quiz Engine ribbon
			pattern. Always visible here so mouse users can also exercise it.
		-->
		<div class="focus-demo-skip-row">
			<button
				type="button"
				class="focus-demo-btn focus-demo-btn--skip"
				data-test-id="focus-skip-to-main"
				onclick={onSkipToMain}
			>
				Skip to Main
			</button>
			<span class="focus-demo-skip-hint">
				Tab here first, then press Enter or Space to jump focus into the section player.
			</span>
		</div>
		<h1>Focus Management</h1>
		<p>
			Exercise the section-player focus contract: the
			<code>SectionPlayerFocusPolicy.autoFocus</code> strategy for framework-owned focus
			moments (mount, Next/Back), and the imperative
			<code>focusStart()</code>
			escape hatch hosts call from a Skip-to-Main button. Use the controls below to switch
			strategies, layouts, and the passage presence.
		</p>
		<div class="focus-demo-controls" role="toolbar" aria-label="Focus management demo controls">
			<fieldset>
				<legend>autoFocus strategy</legend>
				{#each FOCUS_OPTIONS as option}
					<label class="focus-demo-radio">
						<input
							type="radio"
							name="focus-strategy"
							value={option}
							checked={focusStrategy === option}
							data-test-id={`focus-strategy-${option}`}
							onchange={() => (focusStrategy = option)}
						/>
						<span>{option}</span>
					</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Layout</legend>
				{#each LAYOUT_OPTIONS as option}
					<label class="focus-demo-radio">
						<input
							type="radio"
							name="layout-kind"
							value={option}
							checked={layoutKind === option}
							data-test-id={`focus-layout-${option}`}
							onchange={() => (layoutKind = option)}
						/>
						<span>{option}</span>
					</label>
				{/each}
			</fieldset>
			<fieldset>
				<legend>Passage</legend>
				<label class="focus-demo-radio">
					<input
						type="checkbox"
						checked={passageEnabled}
						data-test-id="focus-passage-toggle"
						onchange={(event) =>
							(passageEnabled = (event.currentTarget as HTMLInputElement).checked)}
					/>
					<span>Show passage</span>
				</label>
			</fieldset>
			<div class="focus-demo-actions">
				<button
					type="button"
					class="focus-demo-btn"
					data-test-id="focus-nav-previous"
					onclick={onNavigatePrevious}
				>
					Back
				</button>
				<button
					type="button"
					class="focus-demo-btn"
					data-test-id="focus-nav-next"
					onclick={onNavigateNext}
				>
					Next
				</button>
			</div>
		</div>
		<div class="focus-demo-readout" aria-live="polite" data-test-id="focus-active-element">
			<strong>document.activeElement:</strong>
			<code>{activeElementLabel}</code>
			<span class="focus-demo-readout-sep">·</span>
			<strong>last focusStart():</strong>
			<code data-test-id="focus-skip-result">{lastSkipResult}</code>
		</div>
	</header>

	<section class="focus-demo-player-shell">
		{#key playerKey}
			{#if layoutKind === 'vertical'}
				<pie-section-player-vertical
					bind:this={layoutEl}
					assessment-id="section-demos.focus-management"
					section-id={activeSection.identifier}
					attempt-id="focus-management-attempt"
					section={activeSection}
					env={{ mode: 'gather', role: 'student' }}
					show-toolbar={false}
					policies={policies}
				></pie-section-player-vertical>
			{:else if layoutKind === 'tabbed'}
				<pie-section-player-tabbed
					bind:this={layoutEl}
					assessment-id="section-demos.focus-management"
					section-id={activeSection.identifier}
					attempt-id="focus-management-attempt"
					section={activeSection}
					env={{ mode: 'gather', role: 'student' }}
					show-toolbar={false}
					policies={policies}
				></pie-section-player-tabbed>
			{:else}
				<pie-section-player-splitpane
					bind:this={layoutEl}
					assessment-id="section-demos.focus-management"
					section-id={activeSection.identifier}
					attempt-id="focus-management-attempt"
					section={activeSection}
					env={{ mode: 'gather', role: 'student' }}
					show-toolbar={false}
					policies={policies}
				></pie-section-player-splitpane>
			{/if}
		{/key}
	</section>
</main>

<style>
	.focus-demo-page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		min-height: 0;
		background: var(--pie-background-dark, #ecedf1);
	}

	.focus-demo-header {
		padding: 1rem 1.25rem;
		background: var(--color-base-100, #fff);
		border-bottom: 1px solid var(--pie-border-light, #e5e7eb);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.focus-demo-header h1 {
		margin: 0;
		font-size: 1.25rem;
	}

	.focus-demo-header p {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.focus-demo-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.focus-demo-controls fieldset {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
	}

	.focus-demo-controls legend {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0 0.25rem;
		opacity: 0.7;
	}

	.focus-demo-radio {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	.focus-demo-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	.focus-demo-btn {
		font-size: 0.85rem;
		padding: 0.35rem 0.75rem;
		border-radius: 6px;
		border: 1px solid var(--pie-border-light, #e5e7eb);
		background: var(--color-base-100, #fff);
		cursor: pointer;
	}

	.focus-demo-btn--skip {
		background: var(--pie-focus-outline, #1d4ed8);
		color: #fff;
		border-color: transparent;
		font-weight: 600;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.focus-demo-btn--skip:hover,
	.focus-demo-btn--skip:focus-visible {
		color: #fff;
	}

	.focus-demo-skip-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.focus-demo-skip-hint {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.focus-demo-readout-sep {
		margin: 0 0.4rem;
		opacity: 0.5;
	}

	.focus-demo-readout {
		font-size: 0.85rem;
	}

	.focus-demo-readout code {
		background: var(--pie-background, #f3f4f6);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
	}

	.focus-demo-player-shell {
		flex: 1;
		min-height: 0;
		display: flex;
	}

	:global(.focus-demo-player-shell pie-section-player-splitpane),
	:global(.focus-demo-player-shell pie-section-player-vertical),
	:global(.focus-demo-player-shell pie-section-player-tabbed) {
		display: flex;
		flex: 1;
		height: 100%;
		min-height: 0;
		overflow: hidden;
	}
</style>
