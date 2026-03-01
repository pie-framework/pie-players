<script lang="ts">
	interface Props {
		roleType: 'candidate' | 'scorer';
		layoutType: 'splitpane' | 'vertical';
		candidateHref: string;
		scorerHref: string;
		showSessionPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		onReset: () => void;
		onSetSplitpaneLayout: () => void;
		onSetVerticalLayout: () => void;
		onToggleSessionPanel: () => void;
		onToggleSourcePanel: () => void;
		onTogglePnpPanel: () => void;
	}

	let {
		roleType,
		layoutType,
		candidateHref,
		scorerHref,
		showSessionPanel,
		showSourcePanel,
		showPnpPanel,
		onReset,
		onSetSplitpaneLayout,
		onSetVerticalLayout,
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
				class:btn-active={layoutType === 'splitpane'}
				onclick={onSetSplitpaneLayout}
				title="Splitpane layout"
				aria-label="Use splitpane section player layout"
				aria-pressed={layoutType === 'splitpane'}
			>
				Splitpane
			</button>
			<button
				class="btn btn-sm join-item"
				class:btn-active={layoutType === 'vertical'}
				onclick={onSetVerticalLayout}
				title="Vertical layout"
				aria-label="Use vertical section player layout"
				aria-pressed={layoutType === 'vertical'}
			>
				Vertical
			</button>
		</div>
		<div class="join">
			<a
				class="btn btn-sm join-item"
				class:btn-active={roleType === 'candidate'}
				href={candidateHref}
				data-sveltekit-reload
				title="Candidate view - student taking assessment (gather mode)"
			>
				Student
			</a>
			<a
				class="btn btn-sm join-item"
				class:btn-active={roleType === 'scorer'}
				href={scorerHref}
				data-sveltekit-reload
				title="Scorer view - instructor reviewing/scoring (evaluate mode)"
			>
				Scorer
			</a>
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
