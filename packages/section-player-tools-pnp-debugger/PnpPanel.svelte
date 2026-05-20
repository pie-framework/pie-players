<svelte:options
	customElement={{
		tag: 'pie-section-player-tools-pnp-debugger',
		shadow: 'none',
		props: {
			sectionData: { type: 'Object', attribute: 'section-data' },
			roleType: { type: 'String', attribute: 'role-type' },
			editable: { type: 'Boolean', attribute: 'editable' },
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
		createPatchedPnpProfile,
		derivePnpPanelData,
		TOOL_PLACEMENT_LEVELS,
		type EditableToolRow,
		type PnpEnforcementSelection,
		type PolicyPanelCoordinator
	} from './derive-panel-data.js';
	const dispatch = createEventDispatcher<{ close: undefined }>();

	interface Props {
		sectionData: any;
		roleType: 'candidate' | 'scorer';
		editable?: boolean;
		toolkitCoordinator?: any;
	}

	let {
		sectionData,
		roleType,
		editable = false,
		toolkitCoordinator = null
	}: Props = $props();

	let floatingTools = $state<string[]>([]);
	let simulatedPnpProfile = $state<Record<string, unknown> | null>(null);
	let pnpEnforcementSelection = $state<PnpEnforcementSelection>('auto');
	// Bumped from `coordinator.onPolicyChange(...)` so the
	// `pnpPanelData` derivation re-runs whenever the engine inputs
	// change (assessment binding, PNP override, custom source). The
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
	// Pass-1 contributor (placement, host policy, provider veto,
	// PNP/profile gates, custom sources) — not just PNP — which is the correct
	// debugger surface as of M8. The panel keeps its PNP-focused
	// chrome (title, profile card) but also surfaces the broader
	// per-tool feature trails the engine emits.
	let effectiveSectionData = $derived.by(() => {
		if (!simulatedPnpProfile) return sectionData;
		return {
			...(sectionData || {}),
			personalNeedsProfile: simulatedPnpProfile
		};
	});

	let pnpPanelData = $derived.by(() => {
		void policyVersion;
		return derivePnpPanelData({
			sectionData: effectiveSectionData,
			roleType,
			floatingTools,
			defaultPnpProfile: createDefaultPersonalNeedsProfile(),
			coordinator: toolkitCoordinator as PolicyPanelCoordinator | null
		});
	});

	function placementIds(level: 'section' | 'item' | 'passage'): string[] {
		const ids = toolkitCoordinator?.config?.tools?.placement?.[level];
		return Array.isArray(ids) ? [...ids] : [];
	}

	function setPlacement(level: 'section' | 'item' | 'passage', toolIds: string[]) {
		if (typeof toolkitCoordinator?.updateToolPlacement === 'function') {
			toolkitCoordinator.updateToolPlacement(level, toolIds);
		} else if (level === 'section' && typeof toolkitCoordinator?.updateFloatingTools === 'function') {
			toolkitCoordinator.updateFloatingTools(toolIds);
		}
		policyVersion += 1;
	}

	function togglePlacement(row: EditableToolRow, level: 'section' | 'item' | 'passage') {
		const ids = new Set(placementIds(level));
		if (ids.has(row.toolId)) {
			ids.delete(row.toolId);
		} else {
			ids.add(row.toolId);
		}
		setPlacement(level, Array.from(ids));
	}

	function applyAllAvailablePlacement(enabled: boolean) {
		for (const level of TOOL_PLACEMENT_LEVELS) {
			setPlacement(level, enabled ? pnpPanelData.allAvailablePlacement[level] : []);
		}
	}

	function toggleProvider(row: EditableToolRow) {
		toolkitCoordinator?.updateToolConfig?.(row.toolId, {
			enabled: !row.providerEnabled
		});
		policyVersion += 1;
	}

	function updateSimulatedAssessment(profile: Record<string, unknown>) {
		simulatedPnpProfile = profile;
		toolkitCoordinator?.updateAssessment?.({
			...(sectionData || {}),
			id: sectionData?.id || sectionData?.identifier || 'debug-section',
			personalNeedsProfile: profile
		});
		policyVersion += 1;
	}

	function togglePnp(row: EditableToolRow, key: 'supports' | 'prohibitedSupports') {
		const enabled = key === 'supports' ? !row.pnpSupported : !row.pnpProhibited;
		updateSimulatedAssessment(
			createPatchedPnpProfile(
				pnpPanelData.pnpProfile,
				key,
				row.pnpSupportIds,
				enabled
			)
		);
	}

	function applyPnpEnforcement() {
		const mode = pnpEnforcementSelection === 'auto' ? null : pnpEnforcementSelection;
		if (typeof toolkitCoordinator?.setPnpEnforcement === 'function') {
			toolkitCoordinator.setPnpEnforcement(mode);
		}
		policyVersion += 1;
	}

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
		{#if editable}
			<div class="pie-section-player-tools-pnp-debugger__card" data-testid="pnp-tools-editor">
				<div class="pie-section-player-tools-pnp-debugger__card-title">Tools Editor</div>
				<div class="pie-section-player-tools-pnp-debugger__toolbar">
					<label class="pie-section-player-tools-pnp-debugger__field">
						<span>PNP enforcement</span>
						<select
							bind:value={pnpEnforcementSelection}
							onchange={applyPnpEnforcement}
							data-testid="pnp-enforcement-select"
						>
							<option value="auto">Auto</option>
							<option value="off">Off</option>
							<option value="on">On</option>
						</select>
					</label>
					<span class="pie-section-player-tools-pnp-debugger__pill">
						Effective: {pnpPanelData.pnpEnforcement.effective}
					</span>
					<button type="button" onclick={() => applyAllAvailablePlacement(true)} data-testid="pnp-enable-all-tools">
						All available tools
					</button>
					<button type="button" onclick={() => applyAllAvailablePlacement(false)} data-testid="pnp-clear-all-tools">
						Clear placement
					</button>
				</div>
				<div class="pie-section-player-tools-pnp-debugger__tool-table">
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">Tool</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">Placement</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">Provider</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">PNP simulation</div>
					{#each pnpPanelData.toolRows as row (row.toolId)}
						<div class="pie-section-player-tools-pnp-debugger__tool-name">
							<strong>{row.name}</strong>
							<span>{row.toolId}</span>
						</div>
						<div class="pie-section-player-tools-pnp-debugger__button-row">
							{#each TOOL_PLACEMENT_LEVELS as level}
								{#if row.supportedLevels.includes(level)}
									<button
										type="button"
										class:active={row.placement[level]}
										onclick={() => togglePlacement(row, level)}
										data-testid={`pnp-tool-toggle-${row.toolId}-${level}`}
									>
										{level}{row.visible[level] ? ' visible' : ''}
									</button>
								{:else}
									<span class="pie-section-player-tools-pnp-debugger__muted">{level}</span>
								{/if}
							{/each}
						</div>
						<div>
							<button
								type="button"
								class:active={row.providerEnabled}
								onclick={() => toggleProvider(row)}
								data-testid={`pnp-provider-toggle-${row.toolId}`}
							>
								{row.providerEnabled ? 'enabled' : 'disabled'}
							</button>
						</div>
						<div class="pie-section-player-tools-pnp-debugger__button-row">
							<button
								type="button"
								class:active={row.pnpSupported}
								onclick={() => togglePnp(row, 'supports')}
								data-testid={`pnp-support-toggle-${row.toolId}`}
								title={row.pnpSupportIds.join(', ')}
							>
								support
							</button>
							<button
								type="button"
								class:danger={row.pnpProhibited}
								onclick={() => togglePnp(row, 'prohibitedSupports')}
								data-testid={`pnp-prohibit-toggle-${row.toolId}`}
								title={row.pnpSupportIds.join(', ')}
							>
								prohibit
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}
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

	.pie-section-player-tools-pnp-debugger__toolbar,
	.pie-section-player-tools-pnp-debugger__button-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-items: center;
	}

	.pie-section-player-tools-pnp-debugger__toolbar {
		margin: 0.5rem 0 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger__field {
		display: inline-flex;
		gap: 0.375rem;
		align-items: center;
		font-size: 0.8125rem;
	}

	.pie-section-player-tools-pnp-debugger__field select {
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: white;
	}

	.pie-section-player-tools-pnp-debugger__pill,
	.pie-section-player-tools-pnp-debugger__muted {
		border-radius: 999px;
		background: #f3f4f6;
		color: #4b5563;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	.pie-section-player-tools-pnp-debugger__tool-table {
		display: grid;
		grid-template-columns: minmax(8rem, 1fr) minmax(12rem, 1.5fr) auto minmax(9rem, 1fr);
		gap: 0.5rem;
		align-items: center;
	}

	.pie-section-player-tools-pnp-debugger__tool-heading {
		font-size: 0.75rem;
		font-weight: 700;
		color: #4b5563;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.pie-section-player-tools-pnp-debugger__tool-name {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		font-size: 0.8125rem;
	}

	.pie-section-player-tools-pnp-debugger__tool-name span {
		color: #6b7280;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger button {
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		color: #111827;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	.pie-section-player-tools-pnp-debugger button.active {
		border-color: #2563eb;
		background: #dbeafe;
		color: #1d4ed8;
	}

	.pie-section-player-tools-pnp-debugger button.danger {
		border-color: #dc2626;
		background: #fee2e2;
		color: #b91c1c;
	}

</style>
