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
	import PanelResizeHandle from '@pie-players/pie-section-player-tools-shared/PanelResizeHandle.svelte';
	import PanelWindowControls from '@pie-players/pie-section-player-tools-shared/PanelWindowControls.svelte';
	import {
		computePanelSizeFromViewport,
		createFloatingPanelPointerController
	} from '@pie-players/pie-section-player-tools-shared';
	import { createEventDispatcher } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import {
		PNPToolResolver,
		createDefaultPersonalNeedsProfile,
		createPackagedToolRegistry
	} from '@pie-players/pie-assessment-toolkit';
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

	let pnpWindowX = $state(80);
	let pnpWindowY = $state(120);
	let pnpWindowWidth = $state(460);
	let pnpWindowHeight = $state(560);
	let isPnpMinimized = $state(false);

	const pnpResolver = new PNPToolResolver(createPackagedToolRegistry());
	let floatingTools = $state<string[]>([]);

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

	let pnpPanelData = $derived.by(() => {
		const directProfile = sectionData?.personalNeedsProfile;
		const settingsProfile = sectionData?.settings?.personalNeedsProfile;
		const profile = directProfile || settingsProfile || createDefaultPersonalNeedsProfile();
		const source = directProfile
			? 'section.personalNeedsProfile'
			: settingsProfile
				? 'section.settings.personalNeedsProfile'
				: 'toolkit default profile (derived)';

		const resolverInput = {
			...(sectionData || {}),
			personalNeedsProfile: profile
		};
		const resolution = pnpResolver.resolveToolsWithProvenance(resolverInput as any);

		const toolkitToolConfig = toolkitCoordinator?.config?.tools || null;
		const effectiveFloatingTools = floatingTools.length > 0
			? floatingTools
			: (toolkitCoordinator?.getFloatingTools?.() || toolkitToolConfig?.placement?.section || []);
		const hasCatalogResolver = Boolean(toolkitCoordinator?.catalogResolver);
		const catalogStats = hasCatalogResolver ? toolkitCoordinator.catalogResolver.getStatistics?.() : null;

		return {
			pnpProfile: profile,
			resolvedTools: resolution.tools,
			provenance: {
				summary: resolution.provenance?.summary || null,
				featureCount: resolution.provenance?.features?.size || 0,
				sourceCount: Object.keys(resolution.provenance?.sources || {}).length
			},
			determination: {
				source,
				checked: [
					'section.personalNeedsProfile',
					'section.settings.personalNeedsProfile'
				],
				note: directProfile || settingsProfile
					? 'Profile was taken directly from section payload.'
					: 'No explicit PNP profile was found in section payload, so the toolkit default PNP profile is applied.',
				runtimeContext: {
					role: roleType,
					floatingToolsEnabled: effectiveFloatingTools,
					hasCatalogResolver,
					catalogCount: catalogStats?.totalCatalogs ?? 0,
					assessmentCatalogCount: catalogStats?.assessmentCatalogs ?? 0,
					itemCatalogCount: catalogStats?.itemCatalogs ?? 0
				}
			}
		};
	});

	onMount(() => {
		const initial = computePanelSizeFromViewport(
			{ width: window.innerWidth, height: window.innerHeight },
			{
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
			}
		);
		pnpWindowX = initial.x;
		pnpWindowY = initial.y;
		pnpWindowWidth = initial.width;
		pnpWindowHeight = initial.height;
	});

	onDestroy(() => {
		pointerController.stop();
	});

	const pointerController = createFloatingPanelPointerController({
		getState: () => ({
			x: pnpWindowX,
			y: pnpWindowY,
			width: pnpWindowWidth,
			height: pnpWindowHeight
		}),
		setState: (next: { x: number; y: number; width: number; height: number }) => {
			pnpWindowX = next.x;
			pnpWindowY = next.y;
			pnpWindowWidth = next.width;
			pnpWindowHeight = next.height;
		},
		minWidth: 320,
		minHeight: 220
	});

</script>

<div
	class="pie-section-player-tools-pnp-debugger"
	style="left: {pnpWindowX}px; top: {pnpWindowY}px; width: {pnpWindowWidth}px; {isPnpMinimized ? 'height: auto;' : `height: ${pnpWindowHeight}px;`}"
>
	<div
		class="pie-section-player-tools-pnp-debugger__header"
		onmousedown={(event: MouseEvent) => pointerController.startDrag(event)}
		role="button"
		tabindex="0"
		aria-label="Drag PNP profile panel"
	>
		<div class="pie-section-player-tools-pnp-debugger__header-title">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="pie-section-player-tools-pnp-debugger__icon-sm"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
			</svg>
			<h3 class="pie-section-player-tools-pnp-debugger__title">PNP Profile</h3>
		</div>
		<div class="pie-section-player-tools-pnp-debugger__header-actions">
			<PanelWindowControls
				minimized={isPnpMinimized}
				onToggle={() => (isPnpMinimized = !isPnpMinimized)}
				onClose={() => dispatch('close')}
			/>
		</div>
	</div>

	{#if !isPnpMinimized}
		<div class="pie-section-player-tools-pnp-debugger__content-shell" style="height: {pnpWindowHeight - 50}px;">
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
					<div class="pie-section-player-tools-pnp-debugger__card-title">Provenance Summary</div>
					<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.provenance, null, 2)}</pre>
				</div>
				<div class="pie-section-player-tools-pnp-debugger__card">
					<div class="pie-section-player-tools-pnp-debugger__card-title">PNP Profile (read-only)</div>
					<pre class="pie-section-player-tools-pnp-debugger__card-pre">{JSON.stringify(pnpPanelData.pnpProfile, null, 2)}</pre>
				</div>
			</div>
		</div>
	{/if}

	{#if !isPnpMinimized}
		<PanelResizeHandle onPointerDown={(event: MouseEvent) => pointerController.startResize(event)} />
	{/if}
</div>

<style>
	.pie-section-player-tools-pnp-debugger {
		position: fixed;
		z-index: 9999;
		background: var(--color-base-100, #fff);
		color: var(--color-base-content, #1f2937);
		border: 2px solid var(--color-base-300, #d1d5db);
		border-radius: 8px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		overflow: hidden;
		font-family: var(--pie-font-family, Inter, system-ui, sans-serif);
	}

	.pie-section-player-tools-pnp-debugger__header {
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: var(--color-base-200, #f3f4f6);
		cursor: move;
		user-select: none;
		border-bottom: 1px solid var(--color-base-300, #d1d5db);
	}

	.pie-section-player-tools-pnp-debugger__header-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pie-section-player-tools-pnp-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-pnp-debugger__title {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
	}

	.pie-section-player-tools-pnp-debugger__header-actions {
		display: flex;
		gap: 4px;
	}

	.pie-section-player-tools-pnp-debugger__content-shell {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.pie-section-player-tools-pnp-debugger__resize-handle {
		user-select: none;
	}

</style>
