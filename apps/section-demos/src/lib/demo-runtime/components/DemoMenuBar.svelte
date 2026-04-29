<script lang="ts">
	import DebugPanelToggles from '@pie-players/pie-section-player-tools-shared/DebugPanelToggles.svelte';

	interface Props {
		roleType: 'candidate' | 'scorer';
		layoutType: 'splitpane' | 'vertical';
		candidateHref: string;
		scorerHref: string;
		showSessionPanel: boolean;
		showEventPanel: boolean;
		showInstrumentationPanel: boolean;
		showSourcePanel: boolean;
		showPnpPanel: boolean;
		showTtsPanel: boolean;
		showDbPanel: boolean;
		showInfoDialog: boolean;
		showElementVersionPanel: boolean;
		hasElementVersionTargets: boolean;
		hasElementVersionOverrides: boolean;
		isSessionHydrateDbDemo: boolean;
		selectedDaisyTheme: string;
		daisyThemes: string[];
		onReset: () => void;
		onSetSplitpaneLayout: () => void;
		onSetVerticalLayout: () => void;
		onToggleSessionPanel: () => void;
		onToggleEventPanel: () => void;
		onToggleInstrumentationPanel: () => void;
		onToggleSourcePanel: () => void;
		onTogglePnpPanel: () => void;
		onToggleTtsPanel: () => void;
		onToggleDbPanel: () => void;
		onToggleInfoDialog: () => void;
		onToggleElementVersionPanel: () => void;
		onSelectDaisyTheme: (theme: string) => void;
	}

	let {
		roleType,
		layoutType,
		candidateHref,
		scorerHref,
		showSessionPanel,
		showEventPanel,
		showInstrumentationPanel,
		showSourcePanel,
		showPnpPanel,
		showTtsPanel,
		showDbPanel,
		showInfoDialog,
		showElementVersionPanel,
		hasElementVersionTargets,
		hasElementVersionOverrides,
		isSessionHydrateDbDemo,
		selectedDaisyTheme,
		daisyThemes,
		onReset,
		onSetSplitpaneLayout,
		onSetVerticalLayout,
		onToggleSessionPanel,
		onToggleEventPanel,
		onToggleInstrumentationPanel,
		onToggleSourcePanel,
		onTogglePnpPanel,
		onToggleTtsPanel,
		onToggleDbPanel,
		onToggleInfoDialog,
		onToggleElementVersionPanel,
		onSelectDaisyTheme
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
				aria-current={roleType === 'candidate' ? 'page' : undefined}
			>
				Student
			</a>
			<a
				class="btn btn-sm join-item"
				class:btn-active={roleType === 'scorer'}
				href={scorerHref}
				data-sveltekit-reload
				title="Scorer view - instructor reviewing/scoring (evaluate mode)"
				aria-current={roleType === 'scorer' ? 'page' : undefined}
			>
				Scorer
			</a>
		</div>
	</div>

	<div class="navbar-end gap-2">
		<label class="flex items-center gap-2">
			<select
				class="select select-sm select-bordered"
				value={selectedDaisyTheme}
				onchange={(e) => onSelectDaisyTheme((e.currentTarget as HTMLSelectElement).value)}
				aria-label="Select DaisyUI theme"
				title="Select DaisyUI theme"
			>
				{#each daisyThemes as theme}
					<option value={theme}>{theme}</option>
				{/each}
			</select>
		</label>
		<button
			class="btn btn-sm btn-outline"
			onclick={onReset}
			title="Reset sessions and clear persisted section state"
			aria-label="Reset sessions"
		>
			Reset
		</button>
		<DebugPanelToggles
			{showSessionPanel}
			{showEventPanel}
			{showInstrumentationPanel}
			showDbPanel={isSessionHydrateDbDemo ? showDbPanel : false}
			{onToggleSessionPanel}
			{onToggleEventPanel}
			{onToggleInstrumentationPanel}
			onToggleDbPanel={isSessionHydrateDbDemo ? onToggleDbPanel : undefined}
		/>
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
		<button
			class="btn btn-sm btn-outline btn-square"
			class:btn-active={showInfoDialog}
			onclick={onToggleInfoDialog}
			title="Demo info"
			aria-label="Toggle demo info dialog"
			aria-pressed={showInfoDialog}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<circle cx="12" cy="12" r="9" stroke-width="2"></circle>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10.5v6"></path>
				<circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"></circle>
			</svg>
		</button>
		{#if hasElementVersionTargets}
			<button
				class="btn btn-sm btn-outline btn-square pie-demo-menu-bar__element-versions"
				class:btn-active={showElementVersionPanel}
				class:pie-demo-menu-bar__element-versions--has-overrides={hasElementVersionOverrides}
				onclick={onToggleElementVersionPanel}
				title={hasElementVersionOverrides
					? 'Element versions (overrides active)'
					: 'Element versions'}
				aria-label="Toggle element versions panel"
				aria-pressed={showElementVersionPanel}
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
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
			</button>
		{/if}
		<button
			class="btn btn-sm btn-outline btn-square"
			class:btn-active={showTtsPanel}
			onclick={onToggleTtsPanel}
			title="TTS settings"
			aria-label="Toggle TTS settings panel"
			aria-pressed={showTtsPanel}
		>
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5L6 9H3v6h3l5 4V5z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 9.5a3.5 3.5 0 010 5" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.5 7a7 7 0 010 10" />
			</svg>
		</button>
	</div>
</div>

<style>
	.pie-demo-menu-bar__element-versions {
		position: relative;
	}

	.pie-demo-menu-bar__element-versions--has-overrides::after {
		content: '';
		position: absolute;
		top: 2px;
		right: 2px;
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 9999px;
		background: var(--color-warning, #f59e0b);
		box-shadow: 0 0 0 1px var(--color-base-200, #e5e7eb);
	}
</style>
