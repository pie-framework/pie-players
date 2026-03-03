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
		const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		// Keep the debugger docked left by default so it does not block item interactions.
		pnpWindowWidth = clamp(Math.round(viewportWidth * 0.3), 360, 560);
		pnpWindowHeight = clamp(Math.round(viewportHeight * 0.72), 360, 860);
		pnpWindowX = 16;
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

</script>

<div
	class="pie-section-player-tools-pnp-debugger"
	style="left: {pnpWindowX}px; top: {pnpWindowY}px; width: {pnpWindowWidth}px; {isPnpMinimized ? 'height: auto;' : `height: ${pnpWindowHeight}px;`}"
>
	<div
		class="pie-section-player-tools-pnp-debugger__header"
		onmousedown={startPnpDrag}
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
			<button
				class="pie-section-player-tools-pnp-debugger__icon-button"
				onclick={() => isPnpMinimized = !isPnpMinimized}
				title={isPnpMinimized ? 'Maximize' : 'Minimize'}
			>
				{#if isPnpMinimized}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="pie-section-player-tools-pnp-debugger__icon-xs"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="pie-section-player-tools-pnp-debugger__icon-xs"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				{/if}
			</button>
			<button class="pie-section-player-tools-pnp-debugger__icon-button" onclick={() => dispatch('close')} title="Close">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="pie-section-player-tools-pnp-debugger__icon-xs"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	</div>

	{#if !isPnpMinimized}
		<div class="pie-section-player-tools-pnp-debugger__content-shell" style="height: {pnpWindowHeight - 60}px;">
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
		<div
			class="pie-section-player-tools-pnp-debugger__resize-handle"
			onmousedown={startPnpResize}
			role="button"
			tabindex="0"
			title="Resize window"
		>
			<svg
				class="pie-section-player-tools-pnp-debugger__resize-icon"
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

<style>
	.pie-section-player-tools-pnp-debugger {
		position: fixed;
		z-index: 100;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--pie-white, #fff);
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		border: 2px solid var(--pie-border-light, #d1d5db);
		color: var(--pie-text, #111827);
	}

	.pie-section-player-tools-pnp-debugger__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1rem;
		background: var(--pie-secondary-background, #f3f4f6);
		border-bottom: 1px solid var(--pie-border-light, #d1d5db);
		cursor: move;
		user-select: none;
	}

	.pie-section-player-tools-pnp-debugger__header-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pie-section-player-tools-pnp-debugger__title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
	}

	.pie-section-player-tools-pnp-debugger__header-actions {
		display: flex;
		gap: 0.25rem;
	}

	.pie-section-player-tools-pnp-debugger__icon-button {
		width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 9999px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pie-section-player-tools-pnp-debugger__icon-button:hover {
		background: rgba(17, 24, 39, 0.08);
	}

	.pie-section-player-tools-pnp-debugger__icon-button:focus-visible {
		outline: 2px solid var(--pie-focus-checked-border, #1976d2);
		outline-offset: 1px;
	}

	.pie-section-player-tools-pnp-debugger__icon-sm {
		width: 1rem;
		height: 1rem;
	}

	.pie-section-player-tools-pnp-debugger__icon-xs {
		width: 0.75rem;
		height: 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger__content-shell {
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
		background: var(--pie-secondary-background, #f3f4f6);
		border-radius: 0.375rem;
		padding: 0.75rem;
	}

	.pie-section-player-tools-pnp-debugger__card-title {
		font-size: 0.75rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.pie-section-player-tools-pnp-debugger__card-pre {
		background: var(--pie-background, #e5e7eb);
		padding: 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		overflow-x: auto;
		margin: 0;
	}

	.pie-section-player-tools-pnp-debugger__resize-handle {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 1rem;
		height: 1rem;
		cursor: se-resize;
	}

	.pie-section-player-tools-pnp-debugger__resize-icon {
		width: 100%;
		height: 100%;
		color: color-mix(in srgb, var(--pie-text, #111827) 30%, transparent);
	}
</style>
