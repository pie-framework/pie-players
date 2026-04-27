<svelte:options
	customElement={{
		tag: 'pie-section-player-tools-pnp-debugger',
		shadow: 'none',
		props: {
			sectionData: { type: 'Object', attribute: 'section-data' },
			roleType: { type: 'String', attribute: 'role-type' },
			toolkitCoordinator: { type: 'Object', attribute: 'toolkit-coordinator' }
		}
	}}
/>

<script lang="ts">
	import '@pie-players/pie-theme/components.css';
	import SharedFloatingPanel from '@pie-players/pie-section-player-tools-shared/SharedFloatingPanel.svelte';
	import { createEventDispatcher } from 'svelte';
	import { createDefaultPersonalNeedsProfile } from '@pie-players/pie-assessment-toolkit';
	import {
		derivePnpPanelData,
		type PolicyPanelCoordinator
	} from './derive-panel-data.js';
	const dispatch = createEventDispatcher<{ close: undefined }>();

	interface Props {
		sectionData: any;
		roleType: 'candidate' | 'scorer';
		toolkitCoordinator?: any;
	}

	let {
		sectionData,
		roleType,
		toolkitCoordinator = null
	}: Props = $props();

	let floatingTools = $state<string[]>([]);
	// Bumped from `coordinator.onPolicyChange(...)` so the
	// `pnpPanelData` derivation re-runs whenever the engine inputs
	// change (assessment binding, QTI override, custom source). The
	// coordinator reference itself doesn't change on those events,
	// so a manual reactivity hook is required.
	let policyVersion = $state(0);

	$effect(() => {
		if (!toolkitCoordinator?.onFloatingToolsChange) {
			floatingTools = toolkitCoordinator?.getFloatingTools?.() || [];
			return;
		}
		const unsubscribe = toolkitCoordinator.onFloatingToolsChange((toolIds: string[]) => {
			floatingTools = Array.isArray(toolIds) ? [...toolIds] : [];
		});
		return () => {
			unsubscribe?.();
		};
	});

	$effect(() => {
		if (typeof toolkitCoordinator?.onPolicyChange !== 'function') return;
		const unsubscribe = toolkitCoordinator.onPolicyChange(() => {
			policyVersion += 1;
		});
		return () => {
			try {
				unsubscribe?.();
			} catch {
				// detach errors are non-fatal
			}
		};
	});

	// M8 PR 3 — read the coordinator's owned ToolPolicyEngine via the
	// pure `derivePnpPanelData` helper. Decisions reflect every
	// Pass-1 contributor (placement, host policy, provider veto, QTI
	// gates, custom sources) — not just PNP — which is the correct
	// debugger surface as of M8. The panel keeps its PNP-focused
	// chrome (title, profile card) but also surfaces the broader
	// per-tool feature trails the engine emits.
	let pnpPanelData = $derived.by(() => {
		void policyVersion;
		return derivePnpPanelData({
			sectionData,
			roleType,
			floatingTools,
			defaultPnpProfile: createDefaultPersonalNeedsProfile(),
			coordinator: toolkitCoordinator as PolicyPanelCoordinator | null
		});
	});

</script>

<SharedFloatingPanel
	title="PNP Profile"
	ariaLabel="Drag PNP profile panel"
	minWidth={360}
	minHeight={260}
	initialSizing={{
		widthRatio: 0.3,
		heightRatio: 0.72,
		minWidth: 360,
		maxWidth: 560,
		minHeight: 360,
		maxHeight: 860,
		alignX: 'left',
		alignY: 'center',
		paddingX: 16,
		paddingY: 16
	}}
	className="pie-section-player-tools-pnp-debugger"
	bodyClass="pie-section-player-tools-pnp-debugger__content-shell"
	onClose={() => dispatch('close')}
>
	<svelte:fragment slot="icon">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-pnp-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
			</svg>
	</svelte:fragment>

	<div
		class="pie-section-player-tools-pnp-debugger__content"
		style="height: 100%; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;"
	>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">Determination (read-only)</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.determination, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">Resolved Tools (toolkit)</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.resolvedTools, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">Tool Policy Provenance Summary</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.provenance, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">Per-Tool Decisions</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.featureTrails, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">PNP Profile (read-only)</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.pnpProfile, null, 2)}</pre>
		</div>
	</div>
</SharedFloatingPanel>

<style>
	.pie-section-player-tools-pnp-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

</style>
