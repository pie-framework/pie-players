<svelte:options
	customElement={{
		tag: 'pie-tool-color-scheme',
		shadow: 'none',
		props: {
			visible: { type: 'Boolean', attribute: 'visible' },
			toolId: { type: 'String', attribute: 'tool-id' }
		}
	}}
/>

<!-- ToolColorScheme - WCAG Color Scheme Selection Tool

  Provides accessible color scheme options for users who need
  high contrast or alternative color combinations.

  Addresses WCAG 2.1 Level AA criteria:
  - 1.4.1 Use of Color
  - 1.4.3 Contrast (Minimum)
  - 1.4.11 Non-text Contrast
-->

<script lang="ts">
	const browser = typeof window !== "undefined";

	import {
		assessmentToolkitRuntimeContext,
		ZIndexLayer,
	} from '@pie-players/pie-assessment-toolkit';
	import type {
		AssessmentToolkitRuntimeContext,
		IToolCoordinator,
	} from '@pie-players/pie-assessment-toolkit';
	import { ContextConsumer } from '@pie-players/pie-context';
	import { createFocusTrap, safeLocalStorageGet, safeLocalStorageSet } from '@pie-players/pie-players-shared';
	import { onMount } from 'svelte';

	let {
		visible = false,
		toolId = 'colorScheme'
	}: {
		visible?: boolean;
		toolId?: string;
	} = $props();

	let containerEl = $state<HTMLDivElement | undefined>();
	let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
	let runtimeContextConsumer: ContextConsumer<
		typeof assessmentToolkitRuntimeContext
	> | null = null;
	const coordinator = $derived(
		runtimeContext?.toolCoordinator as IToolCoordinator | undefined,
	);

	// Track registration state
	let registered = $state(false);

	$effect(() => {
		if (!containerEl) return;
		runtimeContextConsumer = new ContextConsumer(containerEl, {
			context: assessmentToolkitRuntimeContext,
			subscribe: true,
			onValue: (value: AssessmentToolkitRuntimeContext) => {
				runtimeContext = value;
			},
		});
		runtimeContextConsumer.connect();
		return () => {
			runtimeContextConsumer?.disconnect();
			runtimeContextConsumer = null;
		};
	});

	// Color scheme options (Learnosity-compatible industry standards)
	const COLOR_SCHEMES = [
		{
			id: 'default',
			name: 'Default',
			description: 'Standard PIE colors',
			preview: {
				bg: '#ffffff',
				text: '#000000',
				primary: '#3f51b5'
			}
		},
		{
			id: 'black-on-white',
			name: 'Black on White',
			description: 'High contrast for readability',
			preview: {
				bg: '#ffffff',
				text: '#000000',
				primary: '#0000cc'
			}
		},
		{
			id: 'white-on-black',
			name: 'White on Black',
			description: 'Inverse high contrast',
			preview: {
				bg: '#000000',
				text: '#ffffff',
				primary: '#ffff00'
			}
		},
		{
			id: 'rose-on-green',
			name: 'Rose on Green',
			description: 'Color blind friendly (protanopia/deuteranopia)',
			preview: {
				bg: '#ccffcc',
				text: '#3d0022',
				primary: '#660044'
			}
		},
		{
			id: 'yellow-on-blue',
			name: 'Yellow on Blue',
			description: 'Strong contrast scheme',
			preview: {
				bg: '#000066',
				text: '#ffff00',
				primary: '#ffff66'
			}
		},
		{
			id: 'black-on-rose',
			name: 'Black on Rose',
			description: 'Warm tinted background',
			preview: {
				bg: '#ffccdd',
				text: '#000000',
				primary: '#880044'
			}
		},
		{
			id: 'light-gray-on-dark-gray',
			name: 'Light Gray on Dark Gray',
			description: 'Reduced brightness for light sensitivity',
			preview: {
				bg: '#333333',
				text: '#e0e0e0',
				primary: '#aaaaaa'
			}
		}
	];

	// Current color scheme
	let currentScheme = $state('default');

	// Dropdown state
	let dropdownOpen = $state(false);

	// Focus trap cleanup function (plain variable, not reactive)
	let cleanupFocusTrap: (() => void) | null = null;

	// Apply color scheme to document
	function applyColorScheme(schemeId: string) {
		if (!browser) return;

		const root = document.documentElement;
		if (schemeId === 'default') {
			root.removeAttribute('data-color-scheme');
		} else {
			root.setAttribute('data-color-scheme', schemeId);
		}

		// Save to localStorage safely
		safeLocalStorageSet('pie-color-scheme', schemeId);
	}

	// Select scheme and close the tool
	// Automatically closes the modal after selection for better UX
	function selectScheme(schemeId: string) {
		currentScheme = schemeId;
		applyColorScheme(schemeId);
		// Close the entire tool modal and deselect toolbar button
		coordinator?.hideTool(toolId);
	}

	// Toggle dropdown
	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}

	// Get current scheme object
	let currentSchemeObj = $derived(COLOR_SCHEMES.find(s => s.id === currentScheme) || COLOR_SCHEMES[0]);

	function handleClose() {
		dropdownOpen = false;
		coordinator?.hideTool(toolId);
	}

	// Handle escape key
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (dropdownOpen) {
				// Close dropdown first
				dropdownOpen = false;
			} else {
				// Close the entire tool
				handleClose();
			}
		} else if (dropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
			// Handle arrow key navigation in dropdown
			e.preventDefault();
			const options = containerEl?.querySelectorAll('.pie-tool-color-scheme__option:not([disabled])') as NodeListOf<HTMLButtonElement>;
			if (!options || options.length === 0) return;

			const currentIndex = Array.from(options).findIndex(opt => opt === document.activeElement);
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
			coordinator.registerTool(toolId, 'Color Scheme', undefined, ZIndexLayer.MODAL);
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
		// Load saved scheme from localStorage safely
		if (browser) {
			const saved = safeLocalStorageGet('pie-color-scheme') ?? 'default';
			if (saved !== 'default') {
				currentScheme = saved;
				// Use requestAnimationFrame to ensure DOM and styles are ready
				requestAnimationFrame(() => {
					applyColorScheme(saved);
				});
			}
		}

		// Click outside handler
		function handleClickOutside(e: MouseEvent) {
			if (!dropdownOpen) return;
			const target = e.target as HTMLElement;
			if (!target.closest('.pie-tool-color-scheme')) {
				dropdownOpen = false;
			}
		}

		document.addEventListener('click', handleClickOutside);

		return () => {
			document.removeEventListener('click', handleClickOutside);
			if (coordinator && toolId) {
				coordinator.unregisterTool(toolId);
			}
		};
	});
</script>

{#if visible}
	<div bind:this={containerEl} class="pie-tool-color-scheme" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="color-scheme-title" onkeydown={handleKeyDown}>
		<div class="pie-tool-color-scheme__header">
			<h3 id="color-scheme-title" class="pie-tool-color-scheme__title">Color Scheme</h3>
			<button
				type="button"
				class="pie-tool-color-scheme__close"
				onclick={handleClose}
				aria-label="Close color scheme selector"
			>
				×
			</button>
		</div>

		<div class="pie-tool-color-scheme__content">
			<p class="pie-tool-color-scheme__description">
				Select a color scheme to improve readability and reduce eye strain.
			</p>

			<button
				type="button"
				class="pie-tool-color-scheme__dropdown-trigger"
				aria-label="Select color scheme"
				aria-expanded={dropdownOpen}
				onclick={toggleDropdown}
			>
				<div class="pie-tool-color-scheme__current">
					<div class="pie-tool-color-scheme__preview">
						<div class="pie-tool-color-scheme__preview-bg" style="background-color: {currentSchemeObj.preview.bg}">
							<div class="pie-tool-color-scheme__preview-text" style="color: {currentSchemeObj.preview.text}">A</div>
							<div class="pie-tool-color-scheme__preview-primary" style="background-color: {currentSchemeObj.preview.primary}"></div>
						</div>
					</div>
					<div class="pie-tool-color-scheme__current-info">
						<div class="pie-tool-color-scheme__current-name">{currentSchemeObj.name}</div>
						<div class="pie-tool-color-scheme__current-description">{currentSchemeObj.description}</div>
					</div>
					<svg class="pie-tool-color-scheme__dropdown-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M7,10L12,15L17,10H7Z"/>
					</svg>
				</div>
			</button>

			{#if dropdownOpen}
				<div class="pie-tool-color-scheme__dropdown" role="menu">
					{#each COLOR_SCHEMES as scheme (scheme.id)}
						<button
							type="button"
							class="pie-tool-color-scheme__option"
							class:pie-tool-color-scheme__option--active={currentScheme === scheme.id}
							role="menuitem"
							aria-label={scheme.name}
							aria-current={currentScheme === scheme.id}
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
							{#if currentScheme === scheme.id}
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
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 90%;
		max-width: 32rem;
		background-color: var(--pie-background, white);
		border: 2px solid var(--pie-border, #ccc);
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		display: flex;
		flex-direction: column;
	}

	.pie-tool-color-scheme__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 2px solid var(--pie-border, #ccc);
	}

	.pie-tool-color-scheme__title {
		font-size: 1.25rem;
		font-weight: 700;
		color: var(--pie-text, black);
		margin: 0;
	}

	.pie-tool-color-scheme__close {
		width: 2rem;
		height: 2rem;
		border: none;
		background: transparent;
		color: var(--pie-text, black);
		font-size: 1.5rem;
		line-height: 1;
		cursor: pointer;
		border-radius: 0.25rem;
	}

	.pie-tool-color-scheme__close:hover {
		background-color: var(--pie-secondary-background, #f0f0f0);
	}

	.pie-tool-color-scheme__content {
		padding: 1rem;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.pie-tool-color-scheme__description {
		margin: 0 0 1rem 0;
		color: var(--pie-text, black);
		opacity: 0.7;
		font-size: 0.875rem;
	}

	.pie-tool-color-scheme__dropdown-trigger {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--pie-border, #ccc);
		border-radius: 0.5rem;
		background-color: var(--pie-background, white);
		color: var(--pie-text, black);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.pie-tool-color-scheme__dropdown-trigger:hover {
		background-color: var(--pie-secondary-background, #f0f0f0);
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
		color: var(--pie-text, black);
	}

	.pie-tool-color-scheme__current-description {
		font-size: 0.75rem;
		color: var(--pie-text, black);
		opacity: 0.6;
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
		background-color: var(--pie-secondary-background, rgba(0, 0, 0, 0.05));
	}

	.pie-tool-color-scheme__option--active {
		background-color: var(--pie-primary-light, rgba(63, 81, 181, 0.1));
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
	}

	.pie-tool-color-scheme__preview-text {
		font-weight: 700;
		font-size: 1.25rem;
	}

	.pie-tool-color-scheme__preview-primary {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
	}

	.pie-tool-color-scheme__info {
		flex: 1;
	}

	.pie-tool-color-scheme__name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--pie-text, black);
		line-height: 1.25;
	}

	.pie-tool-color-scheme__description {
		font-size: 0.75rem;
		color: var(--pie-text, black);
		opacity: 0.6;
	}

	.pie-tool-color-scheme__check {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--pie-primary, #3f51b5);
	}

	/* Keyboard focus styling */
	.pie-tool-color-scheme__close:focus-visible,
	.pie-tool-color-scheme__dropdown-trigger:focus-visible,
	.pie-tool-color-scheme__option:focus-visible {
		outline: 2px solid var(--pie-primary, #3f51b5);
		outline-offset: 2px;
	}
</style>
