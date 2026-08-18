<svelte:options
	customElement={{
		tag: 'pie-section-player-tools-pnp-debugger',
		shadow: 'none',
		props: {
			sectionData: { type: 'Object', attribute: 'section-data' },
			roleType: { type: 'String', attribute: 'role-type' },
			editable: { type: 'Boolean', attribute: 'editable' },
			toolkitCoordinator: { type: 'Object', attribute: 'toolkit-coordinator' },
			persistenceScope: { type: 'String', attribute: 'persistence-scope' },
			persistencePanelId: { type: 'String', attribute: 'persistence-panel-id' }
		}
	}}
/>

<script lang="ts">
	import {
		type AssessmentToolkitRuntimeContext,
		connectToolRuntimeContext,
	} from "@pie-players/pie-assessment-toolkit";
	import { resolveInterfaceI18n } from "@pie-players/pie-players-shared/i18n/provider";
	import { SharedFloatingPanel } from "@pie-players/pie-section-player-tools-shared";
	import { createEventDispatcher, untrack } from 'svelte';
	import { createEmptyPersonalNeedsProfile } from '@pie-players/pie-assessment-toolkit';
	import {
		createPatchedPnpProfile,
		derivePnpPanelData,
		resolveSectionToolIds,
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
		persistenceScope?: string;
		persistencePanelId?: string;
	}

	let {
		sectionData,
		roleType,
		editable = false,
		toolkitCoordinator = null,
		persistenceScope = "",
		persistencePanelId = "pnp-debugger"
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
		const coordinator = toolkitCoordinator as PolicyPanelCoordinator | null;
		const scopeId = sectionData?.id || sectionData?.identifier || 'section';
		untrack(() => {
			floatingTools = resolveSectionToolIds(coordinator, [], scopeId);
		});
		if (typeof toolkitCoordinator?.onPolicyChange !== 'function') {
			return;
		}
		const unsubscribe = toolkitCoordinator.onPolicyChange(() => {
			floatingTools = resolveSectionToolIds(coordinator, [], scopeId);
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
			defaultPnpProfile: createEmptyPersonalNeedsProfile(),
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

	let contextAnchor = $state<HTMLDivElement | null>(null);
	let chromeRuntimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	// Interface locale, re-derived on every context republish.
	const interfaceI18n = $derived(resolveInterfaceI18n(chromeRuntimeContext));
	$effect(() => {
		if (!contextAnchor) return;
		return connectToolRuntimeContext(contextAnchor, (value) => {
			chromeRuntimeContext = value;
		});
	});

</script>

<!-- Context anchor: the panel resolves the toolkit runtime context from here,
     which is how it reaches the published interface-locale provider. -->
<div bind:this={contextAnchor} style="display: none;" aria-hidden="true"></div>

<SharedFloatingPanel
	title={interfaceI18n.t("debug.pnp.title")}
	i18n={interfaceI18n}
	ariaLabel="Drag PNP profile panel"
	minWidth={360}
	minHeight={260}
	{persistenceScope}
	{persistencePanelId}
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
		{#if pnpPanelData.determination.runtimeContext.assessmentBound === false}
			<div
				class="pie-section-player-tools-pnp-debugger__card pie-section-player-tools-pnp-debugger__card--warning"
				data-testid="pnp-no-assessment-bound"
				role="status"
			>
				<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.noAssessmentBound")}</div>
				<p class="pie-section-player-tools-pnp-debugger__card-text">
					Every accommodation below is declined because nothing supplied a profile, not
					because policy denied it. Call <code>updateAssessment(...)</code> on the toolkit
					coordinator.
				</p>
			</div>
		{/if}
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.determinationReadOnly")}</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.determination, null, 2)}</pre>
		</div>
		{#if editable}
			<div class="pie-section-player-tools-pnp-debugger__card" data-testid="pnp-tools-editor">
				<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.toolsEditor")}</div>
				<div class="pie-section-player-tools-pnp-debugger__toolbar">
					<label class="pie-section-player-tools-pnp-debugger__field">
						<span>{interfaceI18n.t("debug.pnp.enforcement")}</span>
						<select
							bind:value={pnpEnforcementSelection}
							onchange={applyPnpEnforcement}
							data-testid="pnp-enforcement-select"
						>
							<option value="auto">{interfaceI18n.t("common.auto")}</option>
							<option value="off">{interfaceI18n.t("common.off")}</option>
							<option value="on">On</option>
						</select>
					</label>
					<span class="pie-section-player-tools-pnp-debugger__pill">
						Effective: {pnpPanelData.pnpEnforcement.effective}
					</span>
					<button type="button" onclick={() => applyAllAvailablePlacement(true)} data-testid="pnp-enable-all-tools">
						{interfaceI18n.t("debug.pnp.allAvailableTools")}
					</button>
					<button type="button" onclick={() => applyAllAvailablePlacement(false)} data-testid="pnp-clear-all-tools">
						{interfaceI18n.t("debug.pnp.clearPlacement")}
					</button>
				</div>
				<div class="pie-section-player-tools-pnp-debugger__tool-table">
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">{interfaceI18n.t("debug.pnp.tool")}</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">{interfaceI18n.t("debug.pnp.placement")}</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">{interfaceI18n.t("debug.pnp.provider")}</div>
					<div class="pie-section-player-tools-pnp-debugger__tool-heading">{interfaceI18n.t("debug.pnp.simulation")}</div>
					{#each pnpPanelData.toolRows as row (row.toolId)}
						<div class="pie-section-player-tools-pnp-debugger__tool-name">
							<strong>{row.name}</strong>
							<span>{row.toolId}</span>
							{#if row.contentDependency}
								<span class="pie-section-player-tools-pnp-debugger__muted"
									>needs {row.contentDependency}</span
								>
							{/if}
						</div>
						<div class="pie-section-player-tools-pnp-debugger__button-row">
							{#if row.placeable}
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
							{:else}
								<!-- A region capability has no placement to toggle and never appears
								     in a placement-scoped decision, so a toggle here could only write
								     config the validator rejects and a "visible" marker could only
								     ever read false. Its availability is the PNP row below plus its
								     content dependency. -->
								<span
									class="pie-section-player-tools-pnp-debugger__muted"
									data-testid={`pnp-tool-region-${row.toolId}`}>host surface (not placed)</span
								>
							{/if}
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
			<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.resolvedTools")}</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.resolvedTools, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.provenanceSummary")}</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.provenance, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.perToolDecisions")}</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.featureTrails, null, 2)}</pre>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__card">
			<div class="pie-section-player-tools-pnp-debugger__card-title">{interfaceI18n.t("debug.pnp.profileReadOnly")}</div>
			<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.pnpProfile, null, 2)}</pre>
		</div>
	</div>
</SharedFloatingPanel>

<style>
	/* Panel chrome and cards, moved here from
	 * @pie-players/pie-theme/components.css. That stylesheet is for authored-content
	 * classes no component owns; these are private to this panel, and 10 of its 13
	 * classes were already defined here, so the split was drift rather than design.
	 *
	 * :global() on the first two is required, not decorative. They are applied by
	 * SharedFloatingPanel rather than by this template -- `className` lands on its
	 * root element and `bodyClass` on its body element -- so Svelte would scope the
	 * selectors to this component and they would match nothing. The rest sit on
	 * elements in this file's markup and scope normally.
	 */
	:global(.pie-section-player-tools-pnp-debugger) {
		position: fixed;
		z-index: 100;
		overflow: hidden;
		/* `--pie-background-dark` rather than `--pie-white`: the schemes define
		   `--pie-white` as the inverse of their ink, which happens to work, but the
		   recessed surface is the pair the contract actually certifies with
		   `--pie-text`. A floating panel cannot take `--pie-background`, which the
		   light Base Theme leaves transparent on purpose. */
		background: var(--pie-background-dark, #ecedf1);
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		border: 2px solid var(--pie-border, #8f8f8f);
		color: var(--pie-text, #111827);
		display: flex;
		flex-direction: column;
	}

	:global(.pie-section-player-tools-pnp-debugger__content-shell) {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.pie-section-player-tools-pnp-debugger__content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex: 1;
		min-height: 0;
	}

	.pie-section-player-tools-pnp-debugger__card {
		/* The certified button pair, so a card stays distinct from the panel's
		   recessed surface on every palette rather than only on light ones. */
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
		border-radius: 0.375rem;
		padding: 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger__card-title {
		font-size: 0.75rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	/*
	 * `--pie-missing` is the warning colour -- the DaisyUI provider maps it from the
	 * `warning` slot, and pie-elements-ng keys it the same way. The previous comment
	 * here claimed the registry had none.
	 */
	.pie-section-player-tools-pnp-debugger__card--warning {
		border-left: 3px solid var(--pie-missing, #b45309);
	}

	.pie-section-player-tools-pnp-debugger__card-text {
		font-size: 0.75rem;
		line-height: 1.4;
		margin: 0;
	}

	.pie-section-player-tools-pnp-debugger__card-pre {
		background: var(--pie-background-dark, #e5e7eb);
		padding: 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		margin: 0;
		overflow-x: auto;
	}

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
		border: 1px solid var(--pie-button-border, #8f8f8f);
		border-radius: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
	}

	.pie-section-player-tools-pnp-debugger__pill,
	.pie-section-player-tools-pnp-debugger__muted {
		border-radius: 999px;
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
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
		color: var(--pie-text, #4b5563);
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
		/* The de-emphasis was a lighter grey, which cannot hold on a dark palette.
		   Size and font carry the hierarchy; the ink stays legible. */
		color: var(--pie-text, #6b7280);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger button {
		border: 1px solid var(--pie-button-border, #8f8f8f);
		border-radius: 0.375rem;
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
	}

	.pie-section-player-tools-pnp-debugger button.active {
		border-color: var(--pie-button-hover-border, #8b919c);
		/* `--pie-button-active-bg` is certified against `--pie-button-color` and
		   nothing else, so the two move together. */
		background: var(--pie-button-active-bg, #f3f4f6);
		color: var(--pie-button-color, #374151);
		font-weight: 600;
	}

	.pie-section-player-tools-pnp-debugger button.danger {
		/* The destructive state rides the border, which keeps the label on a
		   certified pair; `--pie-incorrect` clears 4.5:1 against the page on every
		   scheme, past the 3:1 a boundary owes. */
		border-color: var(--pie-incorrect, #a65f00);
		background: var(--pie-button-bg, #ffffff);
		color: var(--pie-button-color, #374151);
	}

</style>
