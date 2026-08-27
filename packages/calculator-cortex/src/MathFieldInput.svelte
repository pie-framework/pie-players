<script lang="ts">
	import { MathfieldElement } from 'mathlive';
	import mathLiveFonts from 'mathlive/fonts.css?inline';
	import mathLiveStatic from 'mathlive/static.css?inline';
	import { onMount } from 'svelte';
	import {
		acquireMathfieldSettings,
		configureMathfield,
	} from './mathlive-runtime.js';
	import type { CortexCalculatorLocalization } from './localization.js';

	let {
		value,
		label,
		localization,
		restrictedMode,
		focusRequest = 0,
		onInput,
		onCommit,
		onFieldReady,
	}: {
		value: string;
		label: string;
		localization: CortexCalculatorLocalization;
		restrictedMode: boolean;
		focusRequest?: number;
		onInput: (value: string) => void;
		onCommit?: () => void;
		onFieldReady?: (field: MathfieldElement | null) => void;
	} = $props();

	let host = $state<HTMLDivElement | null>(null);
	let field = $state<MathfieldElement | null>(null);
	const settingsOwner = Symbol('pie-cortex-mathfield');
	let releaseSettings: (() => void) | null = null;
	let commitTimer: ReturnType<typeof setTimeout> | null = null;

	MathfieldElement.fontsDirectory = null;
	MathfieldElement.soundsDirectory = null;
	MathfieldElement.computeEngine = null;

	/**
	 * The fonts, and MathLive's static stylesheet.
	 *
	 * The static sheet is what positions `convertLatexToMarkup` output — the keypad's
	 * math key faces and the tape's typeset expressions. Without it every superscript
	 * renders on the baseline, so `sin^{-1}` reads as "sin-1" and `x^2` as "x2". The
	 * `<math-field>` itself styles its own shadow tree and needs neither, but both are
	 * document-level and bundled, so no request leaves the page.
	 */
	function ensureMathLiveStyles(): void {
		if (document.head.querySelector('style[data-pie-mathlive-fonts]')) return;
		const style = document.createElement('style');
		style.dataset.pieMathliveFonts = 'true';
		style.textContent = `${mathLiveFonts}\n${mathLiveStatic}`;
		document.head.append(style);
	}

	$effect(() => {
		if (field && field.value !== value) field.value = value;
	});

	$effect(() => {
		void focusRequest;
		if (focusRequest > 0) field?.focus();
	});

	onMount(() => {
		if (!host) return;
		ensureMathLiveStyles();
		const mathfield = new MathfieldElement();
		mathfield.value = value;
		mathfield.className = 'pie-cortex-mathfield';
		host.append(mathfield);
		configureMathfield(mathfield, label, restrictedMode);
		// MathLive routes keyboard interaction through its shadow keyboard sink.
		// Leaving the host itself contenteditable/focusable creates two nested
		// controls in the accessibility tree, so expose only the named sink.
		mathfield.removeAttribute('contenteditable');
		mathfield.removeAttribute('tabindex');
		const keyboardSink = mathfield.shadowRoot?.querySelector<HTMLElement>(
			'[part="keyboard-sink"]',
		);
		keyboardSink?.setAttribute('aria-label', label);
		const handleInput = () => onInput(mathfield.value);
		// MathLive emits its composed `change` event when Return commits a
		// single-line mathfield. Its matching line-break input notifications may
		// finish asynchronously, so commit in the next task after they have updated
		// the controller instead of letting an unchanged input supersede the worker.
		const handleChange = () => {
			if (commitTimer) clearTimeout(commitTimer);
			commitTimer = setTimeout(() => {
				commitTimer = null;
				onCommit?.();
			}, 50);
		};
		const handleFocus = () => {
			// This fires on every focus, and with the keypad it fires whenever focus
			// returns from a key. Acquiring once is what keeps the captured base
			// settings the page's own rather than this calculator's.
			if (releaseSettings) return;
			releaseSettings = acquireMathfieldSettings(
				settingsOwner,
				localization,
				MathfieldElement,
			);
		};
		const blockClipboard = (event: Event) => {
			if (restrictedMode) event.preventDefault();
		};
		mathfield.addEventListener('input', handleInput);
		mathfield.addEventListener('change', handleChange);
		mathfield.addEventListener('focus', handleFocus);
		mathfield.addEventListener('copy', blockClipboard);
		mathfield.addEventListener('cut', blockClipboard);
		mathfield.addEventListener('paste', blockClipboard);
		mathfield.addEventListener('contextmenu', blockClipboard);
		field = mathfield;
		onFieldReady?.(mathfield);

		return () => {
			onFieldReady?.(null);
			if (commitTimer) clearTimeout(commitTimer);
			commitTimer = null;
			releaseSettings?.();
			releaseSettings = null;
			mathfield.removeEventListener('input', handleInput);
			mathfield.removeEventListener('change', handleChange);
			mathfield.removeEventListener('focus', handleFocus);
			mathfield.removeEventListener('copy', blockClipboard);
			mathfield.removeEventListener('cut', blockClipboard);
			mathfield.removeEventListener('paste', blockClipboard);
			mathfield.removeEventListener('contextmenu', blockClipboard);
			mathfield.remove();
			field = null;
		};
	});
</script>

<div class="pie-cortex-mathfield-host" bind:this={host}></div>

<style>
	.pie-cortex-mathfield-host {
		display: flex;
		min-width: 0;
		width: 100%;
	}

	/*
	 * The `<math-field>` is constructed in JS, so Svelte's scoping never reaches it
	 * and these rules have to be `:global`. What is reachable from outside the
	 * element is its exposed parts plus its documented custom properties — `--hue`
	 * is the only supported way to bring MathLive's own chrome near PIE primary.
	 */
	:global(.pie-cortex-mathfield) {
		box-sizing: border-box;
		width: 100%;
		min-height: 3rem;
		/*
		 * Shared with the tape rows, so history and the active line sit on one left
		 * edge. A tape whose prior rows are two pixels off the live one is the most
		 * visible alignment failure this layout can have.
		 */
		padding: 0.55rem var(--cortex-tape-inset, 0.75rem);
		border: 1px solid var(--pie-border-gray, var(--cortex-border-gray));
		border-radius: var(--cortex-radius-key, 0.25rem);
		background: var(--pie-button-bg, var(--cortex-button-bg));
		color: var(--pie-button-color, var(--cortex-button-color));
		font-size: 1.375rem;
	}

	:global(.pie-cortex-mathfield:focus-within) {
		outline: 3px solid var(--pie-button-focus-outline, var(--cortex-focus-outline));
		outline-offset: 2px;
	}

	/*
	 * `menuItems = []` does not remove the ☰ button: MathLive re-applies
	 * `menuToggle.style.display` on every render, so an inline style of ours is
	 * clobbered on the next keystroke. The part selector is the only stable route.
	 * It also leaves a `div[role="button"]` with no `tabindex` in the tree, which is
	 * a named control no keyboard user can reach — so it goes entirely.
	 */
	:global(.pie-cortex-mathfield::part(menu-toggle)) {
		display: none;
	}

	/* Where this package renders its own keypad, MathLive's toggle would open a
	   second one, docked to the viewport rather than to the tool panel. */
	:global(.pie-cortex-mathfield[data-pie-own-keypad]::part(virtual-keyboard-toggle)) {
		display: none;
	}
</style>
