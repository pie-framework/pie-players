<script lang="ts">
	interface Props {
		demoName: string;
		demoPackage: string;
		activeView: 'delivery' | 'author' | 'source';
		loaderStrategy: 'iife' | 'esm';
		deliveryHref: string;
		authorHref: string;
		sourceHref: string;
		studentHref: string;
		scorerHref: string;
		viewMode: 'student' | 'scorer';
		showSessionPanel: boolean;
		showInstrumentationPanel: boolean;
		showSessionToggle: boolean;
		onSwitchLoaderStrategy: (next: 'iife' | 'esm') => void;
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
		sourceHref,
		studentHref,
		scorerHref,
		viewMode,
		showSessionPanel,
		showInstrumentationPanel,
		showSessionToggle,
		onSwitchLoaderStrategy,
		onToggleSessionPanel,
		onToggleInstrumentationPanel,
	}: Props = $props();
</script>

<div class="navbar bg-base-200 sticky top-0 z-50 shadow-lg pie-demo-menu-bar">
	<div class="navbar-start gap-3 min-w-0">
		<a href="/" class="btn btn-ghost btn-sm shrink-0">&#8592; Back to Demos</a>
		<div class="min-w-0">
			<div class="font-semibold truncate">{demoName}</div>
			<div class="text-xs opacity-85 truncate">{demoPackage}</div>
		</div>
	</div>

	<div class="navbar-center flex flex-wrap gap-3">
		<div class="join">
			<a
				href={deliveryHref}
				class="btn btn-sm join-item"
				class:btn-active={activeView === 'delivery'}
				aria-current={activeView === 'delivery' ? 'page' : undefined}
			>
				Delivery
			</a>
			<a
				href={authorHref}
				class="btn btn-sm join-item"
				class:btn-active={activeView === 'author'}
				aria-current={activeView === 'author' ? 'page' : undefined}
			>
				Author
			</a>
			<a
				href={sourceHref}
				class="btn btn-sm join-item"
				class:btn-active={activeView === 'source'}
				aria-current={activeView === 'source' ? 'page' : undefined}
			>
				Source
			</a>
		</div>

		{#if activeView !== 'source'}
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
					title="Student view - gather mode"
					aria-current={viewMode === 'student' ? 'page' : undefined}
				>
					Student
				</a>
				<a
					class="btn btn-sm join-item"
					class:btn-active={viewMode === 'scorer'}
					href={scorerHref}
					title="Scorer view - evaluate mode"
					aria-current={viewMode === 'scorer' ? 'page' : undefined}
				>
					Scorer
				</a>
			</div>
		{/if}
	</div>

	<div class="navbar-end gap-2">
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
	</div>
</div>

<style>
	.pie-demo-menu-bar {
		padding-left: 1rem;
		padding-right: 1rem;
	}

	@media (max-width: 960px) {
		.pie-demo-menu-bar {
			align-items: stretch;
			gap: 0.75rem;
			padding-top: 0.75rem;
			padding-bottom: 0.75rem;
		}
	}
</style>
