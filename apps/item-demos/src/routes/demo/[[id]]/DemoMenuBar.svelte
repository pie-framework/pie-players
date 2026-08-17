<script lang="ts">
	import { LocaleSelect, ResponsiveDemoMenuBar } from '@pie-players/demo-ui';
	import ThemeSelect from '$lib/components/ThemeSelect.svelte';
	import { DEMO_LOCALES, demoLocale, setDemoLocale } from '$lib/demo-locale.svelte';

	interface Props {
		demoName: string;
		demoPackage: string;
		activeView: 'delivery' | 'author' | 'source' | 'controller';
		loaderStrategy: 'iife' | 'esm';
		deliveryHref: string;
		authorHref: string;
		controllerHref: string;
		sourceHref: string;
		studentHref: string;
		scorerHref: string;
		viewMode: 'student' | 'scorer';
		authorOnly?: boolean;
		showSessionPanel: boolean;
		showInstrumentationPanel: boolean;
		showSessionToggle: boolean;
		onSwitchLoaderStrategy: (next: 'iife' | 'esm') => void;
		onSwitchViewMode?: (next: 'student' | 'scorer', href: string) => void;
		onToggleSessionPanel: () => void;
		onToggleInstrumentationPanel: () => void;
	}

	let {
		demoName,
		demoPackage,
		activeView,
		loaderStrategy,
		deliveryHref,
		authorHref,
		controllerHref,
		sourceHref,
		studentHref,
		scorerHref,
		viewMode,
		authorOnly = false,
		showSessionPanel,
		showInstrumentationPanel,
		showSessionToggle,
		onSwitchLoaderStrategy,
		onSwitchViewMode,
		onToggleSessionPanel,
		onToggleInstrumentationPanel,
	}: Props = $props();
</script>

<ResponsiveDemoMenuBar class="bg-base-200 sticky top-0 z-50 shadow-lg">
	{#snippet start()}
		<a href="/" class="btn btn-ghost btn-sm shrink-0">&#8592; Back to Demos</a>
		<div class="min-w-0">
			<div class="font-semibold truncate">{demoName}</div>
			<div class="text-xs opacity-85 truncate">{demoPackage}</div>
		</div>
	{/snippet}

	{#snippet primary()}
		<div class="join">
			{#if !authorOnly}
				<a
					href={deliveryHref}
					class="btn btn-sm join-item"
					class:btn-active={activeView === 'delivery'}
					aria-current={activeView === 'delivery' ? 'page' : undefined}
				>
					Delivery
				</a>
			{/if}
			<a
				href={authorHref}
				class="btn btn-sm join-item"
				class:btn-active={activeView === 'author'}
				aria-current={activeView === 'author' ? 'page' : undefined}
			>
				Author
			</a>
			{#if !authorOnly}
				<a
					href={controllerHref}
					class="btn btn-sm join-item"
					class:btn-active={activeView === 'controller'}
					aria-current={activeView === 'controller' ? 'page' : undefined}
				>
					Controller
				</a>
			{/if}
			<a
				href={sourceHref}
				class="btn btn-sm join-item"
				class:btn-active={activeView === 'source'}
				aria-current={activeView === 'source' ? 'page' : undefined}
			>
				Source
			</a>
		</div>

		{#if (activeView === 'delivery' || activeView === 'author') && !authorOnly}
			<div class="join" aria-label="Loader strategy">
				<button
					type="button"
					class="btn btn-sm join-item"
					class:btn-active={loaderStrategy === 'iife'}
					onclick={() => onSwitchLoaderStrategy('iife')}
				>
					IIFE
				</button>
				<button
					type="button"
					class="btn btn-sm join-item"
					class:btn-active={loaderStrategy === 'esm'}
					onclick={() => onSwitchLoaderStrategy('esm')}
				>
					ESM
				</button>
			</div>
		{/if}

		{#if activeView === 'delivery'}
			<div class="join" aria-label="Demo role mode">
				<a
					class="btn btn-sm join-item"
					class:btn-active={viewMode === 'student'}
					href={studentHref}
					onclick={(event) => {
						if (!onSwitchViewMode) return;
						event.preventDefault();
						onSwitchViewMode('student', studentHref);
					}}
					title="Student view - gather mode"
					aria-current={viewMode === 'student' ? 'page' : undefined}
				>
					Student
				</a>
				<a
					class="btn btn-sm join-item"
					class:btn-active={viewMode === 'scorer'}
					href={scorerHref}
					onclick={(event) => {
						if (!onSwitchViewMode) return;
						event.preventDefault();
						onSwitchViewMode('scorer', scorerHref);
					}}
					title="Scorer view - evaluate mode"
					aria-current={viewMode === 'scorer' ? 'page' : undefined}
				>
					Scorer
				</a>
				</div>
			{/if}
	{/snippet}

	{#snippet secondary()}
		<LocaleSelect
			locales={DEMO_LOCALES}
			value={demoLocale()}
			onSelect={setDemoLocale}
		/>
		<ThemeSelect />
		{#if showSessionToggle}
			<button
				class="btn btn-sm btn-outline btn-square"
				class:btn-active={showSessionPanel}
				onclick={onToggleSessionPanel}
				title="Session"
				aria-label="Toggle item session panel"
				aria-pressed={showSessionPanel}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
			</button>
		{/if}
		{#if showSessionToggle}
			<button
				class="btn btn-sm btn-outline btn-square"
				class:btn-active={showInstrumentationPanel}
				onclick={onToggleInstrumentationPanel}
				title="Instrumentation"
				aria-label="Toggle instrumentation panel"
				aria-pressed={showInstrumentationPanel}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-4 w-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 13h4l2 6 4-14 2 8h4" />
				</svg>
				</button>
			{/if}
	{/snippet}
</ResponsiveDemoMenuBar>
