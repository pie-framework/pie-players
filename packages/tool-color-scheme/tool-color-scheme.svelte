<svelte:options
	customElement={{
		tag: 'pie-tool-theme',
		shadow: 'open',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<!-- ToolColorScheme - WCAG Color Scheme Selection Tool

  Provides accessible color scheme options for users who need
  high contrast or alternative color combinations.

  Addresses WCAG 2.2 Level AA criteria:
  - 1.4.1 Use of Color
  - 1.4.3 Contrast (Minimum)
  - 1.4.11 Non-text Contrast
-->

<script lang="ts">
	const browser = typeof window !== "undefined";

	import {
		connectToolRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import {
		listPieColorSchemes,
		observePieColorSchemes,
	} from '@pie-players/pie-theme';
	import type {
		AssessmentToolkitRuntimeContext,
		ToolCoordinatorApi,
	} from '@pie-players/pie-assessment-toolkit';
	import { createFocusTrap, safeLocalStorageGet, safeLocalStorageSet } from '@pie-players/pie-players-shared';
	import { onMount } from 'svelte';
	import { resolveInterfaceI18n } from '@pie-players/pie-players-shared/i18n/provider';

	let {
		visible = false,
		toolId = 'theme'
	}: {
		visible?: boolean;
		toolId?: string;
	} = $props();

	let containerEl = $state<HTMLDivElement | undefined>();
	let dropdownTriggerEl = $state<HTMLButtonElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as ToolCoordinatorApi | undefined,
	);

	// Track registration state
	let registered = $state(false);

	$effect(() => {
		if (!containerEl) return;
		return connectToolRuntimeContext(containerEl, (value: AssessmentToolkitRuntimeContext) => {
			runtimeContext = value;
		});
	});

	function resolveThemeHost(): HTMLElement | null {
		const localHost = containerEl?.closest('pie-theme') as HTMLElement | null;
		if (localHost) return localHost;
		const scopedDocumentHost = document.querySelector('pie-theme[scope="document"]') as HTMLElement | null;
		if (scopedDocumentHost) return scopedDocumentHost;
		return document.querySelector('pie-theme') as HTMLElement | null;
	}

	// Interface locale, re-derived on every context republish.
	const interfaceI18n = $derived(resolveInterfaceI18n(runtimeContext));

	// Scheme names and descriptions come from the theme registry, not from this
	// catalog. They are registration data a host can extend — the same call as
	// `ToolRegistration.name` — so localizing them belongs to whoever registers
	// the scheme.
	let colorSchemeSnapshot = $state.raw(listPieColorSchemes());
	const availableSchemes = $derived(
		colorSchemeSnapshot.schemes.map((scheme) => ({
			...scheme,
			description: scheme.description || '',
			available: true as const
		}))
	);

	// The requested id remains stable even when its custom registration is absent.
	let requestedScheme = $state('default');

	// Dropdown state
	let dropdownOpen = $state(false);

	// Focus trap cleanup function (plain variable, not reactive)
	let cleanupFocusTrap: (() => void) | null = null;

	// Apply color scheme to document
	function applyColorScheme(schemeId: string) {
		if (!browser) return;

		const themeHost = resolveThemeHost();
		if (themeHost) {
			themeHost.setAttribute('scheme', schemeId || 'default');
		} else {
			const root = document.documentElement;
			if (schemeId === 'default') {
				root.removeAttribute('data-color-scheme');
			} else {
				root.setAttribute('data-color-scheme', schemeId);
			}
		}

		// Save to localStorage safely
		safeLocalStorageSet('pie-color-scheme', schemeId);
	}

	// Select scheme and close the tool
	// Automatically closes the modal after selection for better UX
	function selectScheme(schemeId: string) {
		requestedScheme = schemeId;
		dropdownOpen = false;
		applyColorScheme(schemeId);
		// Close the entire tool modal and deselect toolbar button
		coordinator?.hideTool(toolId);
	}

	// Toggle dropdown
	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	const requestedSchemeOption = $derived.by(() => {
		const available = availableSchemes.find((scheme) => scheme.id === requestedScheme);
		if (available) return available;

		const fallback =
			availableSchemes.find((scheme) => scheme.id === 'default') ||
			availableSchemes[0];
		if (!fallback) return null;

		return {
			id: requestedScheme,
			name: interfaceI18n.t('tools.theme.unavailableName', { id: requestedScheme }),
			description: interfaceI18n.t('tools.theme.unavailableDescription'),
			kind: 'unavailable' as const,
			preview: fallback.preview,
			available: false as const
		};
	});
	const displayedSchemes = $derived(
		requestedSchemeOption && !requestedSchemeOption.available
			? [requestedSchemeOption, ...availableSchemes]
			: availableSchemes
	);

	// Handle escape key
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (dropdownOpen) {
				e.preventDefault();
				e.stopPropagation();
				dropdownOpen = false;
				queueMicrotask(() => dropdownTriggerEl?.focus());
			}
		} else if (dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			// Handle arrow key navigation in dropdown
			e.preventDefault();
			const options = containerEl?.querySelectorAll('.pie-tool-color-scheme__option:not([disabled])') as NodeListOf<HTMLButtonElement>;
			if (!options || options.length === 0) return;

			const currentIndex = Array.from(options).findIndex(opt => opt === e.composedPath()[0]);
			let nextIndex: number;

			if (e.key === 'ArrowDown') {
				nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
			} else {
				nextIndex = currentIndex === -1 ? options.length - 1 : (currentIndex - 1 + options.length) % options.length;
			}

			options[nextIndex]?.focus();
		}
	}

	// Register with coordinator when it becomes available
	$effect(() => {
		if (coordinator && toolId && !registered) {
			coordinator.registerTool(toolId, 'Theme', undefined, ZIndexLayer.MODAL);
			registered = true;
		}
	});

	// Update element reference when container becomes available
	$effect(() => {
		if (coordinator && containerEl && toolId) {
			coordinator.updateToolElement(toolId, containerEl);
		}
	});

	// Handle focus trap cleanup when visibility changes
	$effect(() => {
		if (!visible && cleanupFocusTrap) {
			cleanupFocusTrap();
			cleanupFocusTrap = null;
		} else if (visible && containerEl && !cleanupFocusTrap) {
			cleanupFocusTrap = createFocusTrap(containerEl);
		}
	});

	onMount(() => {
		const stopObservingColorSchemes = observePieColorSchemes((snapshot) => {
			const focusedOption = containerEl?.getRootNode() instanceof ShadowRoot
				? (containerEl.getRootNode() as ShadowRoot).activeElement?.closest('.pie-tool-color-scheme__option')
				: null;
			const focusedSchemeId = focusedOption?.getAttribute('data-scheme-id');
			colorSchemeSnapshot = snapshot;
			if (
				focusedSchemeId &&
				!snapshot.schemes.some((scheme) => scheme.id === focusedSchemeId)
			) {
				queueMicrotask(() => dropdownTriggerEl?.focus());
			}
		});

		// Load saved scheme from localStorage safely
		if (browser) {
			const themeHost = resolveThemeHost();
			const hostScheme = themeHost?.getAttribute('scheme');
			const saved = safeLocalStorageGet('pie-color-scheme') ?? hostScheme ?? 'default';
			requestedScheme = saved;
			if (saved) {
				requestAnimationFrame(() => {
					applyColorScheme(saved);
				});
			}
		}

		// Click outside handler
		function handleClickOutside(e: MouseEvent) {
			if (!dropdownOpen) return;
			const clickPath = e.composedPath();
			if (!containerEl || !clickPath.includes(containerEl)) {
				dropdownOpen = false;
			}
		}

		document.addEventListener('click', handleClickOutside);

		return () => {
			stopObservingColorSchemes();
			document.removeEventListener('click', handleClickOutside);
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});
</script>

{#if visible}
	<div
		bind:this={containerEl}
		class="pie-tool-color-scheme"
		role="dialog"
		tabindex="-1"
		lang={interfaceI18n.getLocale()}
		dir={interfaceI18n.getDirection?.() ?? 'ltr'}
		aria-label={interfaceI18n.t('tools.theme.selectorA11y')}
		onkeydown={handleKeyDown}
	>
		<div class="pie-tool-color-scheme__content">
			<p class="pie-tool-color-scheme__description">
				{interfaceI18n.t('tools.theme.hint')}
			</p>

			<button
				bind:this={dropdownTriggerEl}
				type="button"
				class="pie-tool-color-scheme__dropdown-trigger"
				aria-label={requestedSchemeOption
					? interfaceI18n.t('tools.theme.selectCurrentA11y', {
							name: requestedSchemeOption.name
						})
					: interfaceI18n.t('tools.theme.selectA11y')}
				aria-expanded={dropdownOpen}
				aria-haspopup="menu"
				aria-controls="pie-tool-color-scheme-menu"
				aria-describedby={requestedSchemeOption && !requestedSchemeOption.available ? 'pie-tool-color-scheme-status' : undefined}
				onclick={toggleDropdown}
			>
				{#if requestedSchemeOption}
					<div class="pie-tool-color-scheme__current">
						<div class="pie-tool-color-scheme__preview">
							<div class="pie-tool-color-scheme__preview-bg" style="background-color: {requestedSchemeOption.preview.bg}">
								<div class="pie-tool-color-scheme__preview-text" style="color: {requestedSchemeOption.preview.text}">A</div>
								<div class="pie-tool-color-scheme__preview-primary" style="background-color: {requestedSchemeOption.preview.primary}"></div>
							</div>
						</div>
						<div class="pie-tool-color-scheme__current-info">
							<div class="pie-tool-color-scheme__current-name">{requestedSchemeOption.name}</div>
							<div class="pie-tool-color-scheme__current-description">{requestedSchemeOption.description}</div>
						</div>
						<svg class="pie-tool-color-scheme__dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M7,10L12,15L17,10H7Z"/>
						</svg>
					</div>
				{/if}
			</button>

			<p
				id="pie-tool-color-scheme-status"
				class="pie-tool-color-scheme__status"
				class:pie-tool-color-scheme__status--empty={requestedSchemeOption?.available !== false}
				role="status"
				aria-live="polite"
			>
				{#if requestedSchemeOption && !requestedSchemeOption.available}
					{interfaceI18n.t('tools.theme.unavailableStatus')}
				{/if}
			</p>

			{#if dropdownOpen}
				<div id="pie-tool-color-scheme-menu" class="pie-tool-color-scheme__dropdown" role="menu">
					{#each displayedSchemes as scheme (scheme.id)}
						<button
							type="button"
							class="pie-tool-color-scheme__option"
							class:pie-tool-color-scheme__option--active={requestedScheme === scheme.id}
							role="menuitem"
							aria-label={scheme.available
								? scheme.name
								: interfaceI18n.t('tools.theme.optionUnavailableA11y', {
										name: scheme.name
									})}
							aria-current={requestedScheme === scheme.id}
							aria-disabled={!scheme.available}
							disabled={!scheme.available}
							data-scheme-id={scheme.id}
							onclick={() => selectScheme(scheme.id)}
						>
							<div class="pie-tool-color-scheme__preview">
								<div class="pie-tool-color-scheme__preview-bg" style="background-color: {scheme.preview.bg}">
									<div class="pie-tool-color-scheme__preview-text" style="color: {scheme.preview.text}">A</div>
									<div class="pie-tool-color-scheme__preview-primary" style="background-color: {scheme.preview.primary}"></div>
								</div>
							</div>
							<div class="pie-tool-color-scheme__info">
								<div class="pie-tool-color-scheme__name">{scheme.name}</div>
								<div class="pie-tool-color-scheme__description">{scheme.description}</div>
							</div>
							{#if requestedScheme === scheme.id}
								<svg xmlns="http://www.w3.org/2000/svg" class="pie-tool-color-scheme__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.pie-tool-color-scheme {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		background-color: var(--pie-background, white);
		display: flex;
		flex-direction: column;
	}

	.pie-tool-color-scheme__content {
		padding: 1rem;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		overflow: auto;
	}

	.pie-tool-color-scheme__description {
		margin: 0 0 1rem 0;
		color: var(--pie-text, black);
		font-size: 0.875rem;
	}

	.pie-tool-color-scheme__dropdown-trigger {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--pie-button-border, #767676);
		border-radius: 0.5rem;
		background-color: var(--pie-button-bg, white);
		color: var(--pie-button-color, black);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pie-tool-color-scheme__dropdown-trigger:hover {
		border-color: var(--pie-button-hover-border, #767676);
		background-color: var(--pie-button-hover-bg, #f0f0f0);
		color: var(--pie-button-hover-color, black);
	}

	.pie-tool-color-scheme__current {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.pie-tool-color-scheme__current-info {
		flex: 1;
		text-align: left;
	}

	.pie-tool-color-scheme__current-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: inherit;
	}

	.pie-tool-color-scheme__current-description {
		font-size: 0.75rem;
		color: inherit;
	}

	.pie-tool-color-scheme__status {
		margin: 0;
		padding: 0.75rem;
		border: 2px solid var(--pie-button-border, #767676);
		border-radius: 0.5rem;
		background-color: var(--pie-button-bg, #f0f0f0);
		color: var(--pie-button-color, #000000);
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.pie-tool-color-scheme__status--empty {
		display: block;
		width: 0;
		height: 0;
		padding: 0;
		margin: 0;
		overflow: hidden;
		border: 0;
	}

	.pie-tool-color-scheme__dropdown-arrow {
		width: 1.5rem;
		height: 1.5rem;
		flex-shrink: 0;
	}

	.pie-tool-color-scheme__dropdown {
		position: relative;
		width: 100%;
		max-height: 24rem;
		background-color: var(--pie-background, white);
		border: 2px solid var(--pie-border, #ccc);
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		overflow-y: auto;
		overflow-x: hidden;
		margin-top: 0.5rem;
	}

	.pie-tool-color-scheme__option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem 1rem;
		border: none;
		background-color: transparent;
		color: var(--pie-text, black);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s ease;
	}

	.pie-tool-color-scheme__option:hover {
		background-color: var(--pie-button-hover-bg, rgba(0, 0, 0, 0.05));
		color: var(--pie-button-hover-color, black);
	}

	.pie-tool-color-scheme__option--active {
		background-color: var(--pie-button-active-bg, #f3f4f6);
		color: var(--pie-button-color, var(--pie-text, #374151));
	}

	.pie-tool-color-scheme__option:disabled {
		outline: 2px dashed var(--pie-button-border, #767676);
		outline-offset: -2px;
		background-color: var(--pie-button-bg, #f0f0f0);
		color: var(--pie-button-color, #000000);
		cursor: not-allowed;
	}

	.pie-tool-color-scheme__preview {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		border: 2px solid var(--pie-border, #ccc);
		border-radius: 0.25rem;
		overflow: hidden;
	}

	.pie-tool-color-scheme__preview-bg {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #ffffff;
	}

	.pie-tool-color-scheme__preview-text {
		font-weight: 700;
		font-size: 1.25rem;
		color: #000000;
	}

	.pie-tool-color-scheme__preview-primary {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background-color: #3f51b5;
	}

	.pie-tool-color-scheme__info {
		flex: 1;
	}

	.pie-tool-color-scheme__name {
		font-size: 0.875rem;
		font-weight: 600;
		color: inherit;
		line-height: 1.25;
	}

	.pie-tool-color-scheme__info .pie-tool-color-scheme__description {
		font-size: 0.75rem;
		color: inherit;
	}

	.pie-tool-color-scheme__check {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: currentColor;
	}

	/* Keyboard focus styling */
	.pie-tool-color-scheme__dropdown-trigger:focus-visible,
	.pie-tool-color-scheme__option:focus-visible {
		outline: 2px solid var(--pie-button-focus-outline, #3b82f6);
		outline-offset: -2px;
	}
</style>
