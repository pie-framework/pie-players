<svelte:options
	customElement={{
		tag: 'pie-section-player-tools-pnp-debugger',
		shadow: 'open',
		props: {
			sectionData: { type: 'Object', attribute: 'section-data' },
			roleType: { type: 'String', attribute: 'role-type' },
			toolkitCoordinator: { type: 'Object', attribute: 'toolkit-coordinator' }
		}
	}}
/>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import {
		PNPToolResolver,
		createDefaultPersonalNeedsProfile,
		createDefaultToolRegistry
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
	let isPnpDragging = $state(false);
	let isPnpResizing = $state(false);

	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartWindowX = 0;
	let dragStartWindowY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	const pnpResolver = new PNPToolResolver(createDefaultToolRegistry());

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
		const floatingTools = toolkitCoordinator?.getFloatingTools?.() ||
			toolkitToolConfig?.floatingTools?.enabledTools || [];
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
					floatingToolsEnabled: floatingTools,
					hasCatalogResolver,
					catalogCount: catalogStats?.totalCatalogs ?? 0,
					assessmentCatalogCount: catalogStats?.assessmentCatalogs ?? 0,
					itemCatalogCount: catalogStats?.itemCatalogs ?? 0
				}
			}
		};
	});

	onMount(() => {
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		pnpWindowWidth = clamp(Math.round(viewportWidth * 0.62), 460, 1040);
		pnpWindowHeight = clamp(Math.round(viewportHeight * 0.72), 360, 860);
		pnpWindowX = Math.max(16, Math.round((viewportWidth - pnpWindowWidth) / 2));
		pnpWindowY = Math.max(16, Math.round((viewportHeight - pnpWindowHeight) / 2));
	});

	onDestroy(() => {
		document.removeEventListener('mousemove', onPnpDrag);
		document.removeEventListener('mouseup', stopPnpDrag);
		document.removeEventListener('mousemove', onPnpResize);
		document.removeEventListener('mouseup', stopPnpResize);
	});

	function startPnpDrag(e: MouseEvent) {
		isPnpDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartWindowX = pnpWindowX;
		dragStartWindowY = pnpWindowY;
		document.addEventListener('mousemove', onPnpDrag);
		document.addEventListener('mouseup', stopPnpDrag);
	}

	function onPnpDrag(e: MouseEvent) {
		if (!isPnpDragging) return;
		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;
		pnpWindowX = dragStartWindowX + deltaX;
		pnpWindowY = dragStartWindowY + deltaY;
		pnpWindowX = Math.max(0, Math.min(pnpWindowX, window.innerWidth - pnpWindowWidth));
		pnpWindowY = Math.max(0, Math.min(pnpWindowY, window.innerHeight - 100));
	}

	function stopPnpDrag() {
		isPnpDragging = false;
		document.removeEventListener('mousemove', onPnpDrag);
		document.removeEventListener('mouseup', stopPnpDrag);
	}

	function startPnpResize(e: MouseEvent) {
		isPnpResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartWidth = pnpWindowWidth;
		resizeStartHeight = pnpWindowHeight;
		e.preventDefault();
		e.stopPropagation();
		document.addEventListener('mousemove', onPnpResize);
		document.addEventListener('mouseup', stopPnpResize);
	}

	function onPnpResize(e: MouseEvent) {
		if (!isPnpResizing) return;
		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;
		pnpWindowWidth = Math.max(320, Math.min(resizeStartWidth + deltaX, window.innerWidth - pnpWindowX));
		pnpWindowHeight = Math.max(220, Math.min(resizeStartHeight + deltaY, window.innerHeight - pnpWindowY));
	}

	function stopPnpResize() {
		isPnpResizing = false;
		document.removeEventListener('mousemove', onPnpResize);
		document.removeEventListener('mouseup', stopPnpResize);
	}

	function onPanelContentWheel(e: WheelEvent) {
		const container = e.currentTarget as HTMLElement | null;
		if (!container) return;
		// Keep wheel scrolling inside the floating panel instead of bubbling to page.
		e.preventDefault();
		e.stopPropagation();
		container.scrollTop += e.deltaY;
	}
</script>

<div
	class="fixed z-100 flex flex-col overflow-hidden bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
	style="left: {pnpWindowX}px; top: {pnpWindowY}px; width: {pnpWindowWidth}px; {isPnpMinimized ? 'height: auto;' : `height: ${pnpWindowHeight}px;`}"
>
	<div
		class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
		onmousedown={startPnpDrag}
		role="button"
		tabindex="0"
		aria-label="Drag PNP profile panel"
	>
		<div class="flex items-center gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
			</svg>
			<h3 class="font-bold text-sm">PNP Profile</h3>
		</div>
		<div class="flex gap-1">
			<button
				class="btn btn-xs btn-ghost btn-circle"
				onclick={() => isPnpMinimized = !isPnpMinimized}
				title={isPnpMinimized ? 'Maximize' : 'Minimize'}
			>
				{#if isPnpMinimized}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button class="btn btn-xs btn-ghost btn-circle" onclick={() => dispatch('close')} title="Close">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	{#if !isPnpMinimized}
		<div class="p-4 flex flex-col min-h-0 overflow-hidden" style="height: {pnpWindowHeight - 60}px;">
			<div
				class="space-y-3 flex-1 min-h-0"
				style="height: 100%; overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;"
				onwheel={onPanelContentWheel}
			>
				<div class="bg-base-200 rounded p-3">
					<div class="text-xs font-semibold mb-2">Determination (read-only)</div>
					<pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(pnpPanelData.determination, null, 2)}</pre>
				</div>
				<div class="bg-base-200 rounded p-3">
					<div class="text-xs font-semibold mb-2">Resolved Tools (toolkit)</div>
					<pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(pnpPanelData.resolvedTools, null, 2)}</pre>
				</div>
				<div class="bg-base-200 rounded p-3">
					<div class="text-xs font-semibold mb-2">Provenance Summary</div>
					<pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(pnpPanelData.provenance, null, 2)}</pre>
				</div>
				<div class="bg-base-200 rounded p-3">
					<div class="text-xs font-semibold mb-2">PNP Profile (read-only)</div>
					<pre class="bg-base-300 p-2 rounded text-xs overflow-x-auto">{JSON.stringify(pnpPanelData.pnpProfile, null, 2)}</pre>
				</div>
			</div>
		</div>
	{/if}

	{#if !isPnpMinimized}
		<div
			class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
			onmousedown={startPnpResize}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			<svg
				class="w-full h-full text-base-content/30"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M16 16V14H14V16H16Z" />
				<path d="M16 11V9H14V11H16Z" />
				<path d="M13 16V14H11V16H13Z" />
			</svg>
		</div>
	{/if}
</div>
