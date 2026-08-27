<script lang="ts">
	import { MathfieldElement } from 'mathlive';
	import mathLiveFonts from 'mathlive/fonts.css?inline';
	import { onMount } from 'svelte';
	import type { CalculatorType } from '@pie-players/pie-calculator';
	import {
		acquireMathLiveKeyboard,
		configureMathfield,
	} from './mathlive-runtime.js';
	import type { CortexCalculatorLocalization } from './localization.js';

	let {
		value,
		label,
		type,
		localization,
		restrictedMode,
		focusRequest = 0,
		onInput,
		onCommit,
	}: {
		value: string;
		label: string;
		type: CalculatorType;
		localization: CortexCalculatorLocalization;
		restrictedMode: boolean;
		focusRequest?: number;
		onInput: (value: string) => void;
		onCommit?: () => void;
	} = $props();

	let host = $state<HTMLDivElement | null>(null);
	let field = $state<MathfieldElement | null>(null);
	const keyboardOwner = Symbol('pie-cortex-mathfield');
	let releaseKeyboard: (() => void) | null = null;
	let commitTimer: ReturnType<typeof setTimeout> | null = null;

	MathfieldElement.fontsDirectory = null;
	MathfieldElement.soundsDirectory = null;
	MathfieldElement.computeEngine = null;

	function ensureMathLiveFonts(): void {
		if (document.head.querySelector('style[data-pie-mathlive-fonts]')) return;
		const style = document.createElement('style');
		style.dataset.pieMathliveFonts = 'true';
		style.textContent = mathLiveFonts;
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
		ensureMathLiveFonts();
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
			releaseKeyboard?.();
			releaseKeyboard = acquireMathLiveKeyboard(
				keyboardOwner,
				type,
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

		return () => {
			if (commitTimer) clearTimeout(commitTimer);
			commitTimer = null;
			releaseKeyboard?.();
			releaseKeyboard = null;
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

	:global(.pie-cortex-mathfield) {
		box-sizing: border-box;
		width: 100%;
		min-height: 3rem;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--pie-button-border, var(--pie-border, #64748b));
		border-radius: 0.35rem;
		background: var(--pie-button-bg, var(--pie-background, #fff));
		color: var(--pie-button-color, var(--pie-text, #0f172a));
		font-size: 1.2rem;
	}

	:global(.pie-cortex-mathfield:focus-within) {
		outline: 3px solid var(--pie-button-focus-outline, #2563eb);
		outline-offset: 2px;
	}
</style>
