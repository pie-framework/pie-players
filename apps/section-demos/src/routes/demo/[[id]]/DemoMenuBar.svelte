<script lang="ts">
	interface Props {
		layoutType: 'vertical' | 'split-panel';
		roleType: 'candidate' | 'scorer';
		showSessionPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		onSelectLayout: (layout: 'vertical' | 'split-panel') => void;
		onSelectRole: (role: 'candidate' | 'scorer') => void;
		onReset: () => void;
		onToggleSessionPanel: () => void;
		onToggleSourcePanel: () => void;
		onTogglePnpPanel: () => void;
	}

	let {
		layoutType,
		roleType,
		showSessionPanel,
		showSourcePanel,
		showPnpPanel,
		onSelectLayout,
		onSelectRole,
		onReset,
		onToggleSessionPanel,
		onToggleSourcePanel,
		onTogglePnpPanel
	}: Props = $props();
</script>

<div class="navbar bg-base-200 mb-0 sticky top-0 z-50 shadow-lg">
	<div class="navbar-start">
		<a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
	</div>

	<div class="navbar-center flex gap-4 items-center">
		<div class="join">
			<button
				class="btn btn-sm join-item"
				class:btn-active={layoutType === 'split-panel'}
				onclick={() => onSelectLayout('split-panel')}
				title="Split panel - passages left, items right"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m0-16v16m0-16h10a2 2 0 012 2v12a2 2 0 01-2 2H9" />
				</svg>
				Split
			</button>
			<button
				class="btn btn-sm join-item"
				class:btn-active={layoutType === 'vertical'}
				onclick={() => onSelectLayout('vertical')}
				title="Vertical layout - passages first, then items"
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
				Vertical
			</button>
		</div>

		<div class="divider divider-horizontal"></div>

		<div class="join">
			<button
				class="btn btn-sm join-item"
				class:btn-active={roleType === 'candidate'}
				onclick={() => onSelectRole('candidate')}
				title="Candidate view - student taking assessment (gather mode)"
			>
				Student
			</button>
			<button
				class="btn btn-sm join-item"
				class:btn-active={roleType === 'scorer'}
				onclick={() => onSelectRole('scorer')}
				title="Scorer view - instructor reviewing/scoring (evaluate mode)"
			>
				Scorer
			</button>
		</div>
	</div>

	<div class="navbar-end gap-2">
		<button
			class="btn btn-sm btn-outline"
			onclick={onReset}
			title="Reset sessions and clear persisted section state"
			aria-label="Reset sessions"
		>
			Reset
		</button>
		<button
			class="btn btn-sm btn-outline btn-square"
			class:btn-active={showSessionPanel}
			onclick={onToggleSessionPanel}
			title="Session"
			aria-label="Toggle session panel"
			aria-pressed={showSessionPanel}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
		</button>
		<button
			class="btn btn-sm btn-outline btn-square"
			class:btn-active={showSourcePanel}
			onclick={onToggleSourcePanel}
			title="Source"
			aria-label="Toggle source panel"
			aria-pressed={showSourcePanel}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
			</svg>
		</button>
		<button
			class="btn btn-sm btn-outline btn-square"
			class:btn-active={showPnpPanel}
			onclick={onTogglePnpPanel}
			title="PNP profile"
			aria-label="Toggle PNP profile panel"
			aria-pressed={showPnpPanel}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
			</svg>
		</button>
	</div>
</div>
