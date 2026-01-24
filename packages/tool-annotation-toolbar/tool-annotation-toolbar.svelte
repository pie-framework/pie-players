<svelte:options
	customElement={{
		tag: 'pie-tool-annotation-toolbar',
		shadow: 'none',
		props: {
			enabled: { type: 'Boolean', attribute: 'enabled' },
			highlightCoordinator: { type: 'Object', attribute: 'highlight-coordinator' }
		}
	}}
/>

<script lang="ts">
	import type { HighlightCoordinator, ITTSService } from '@pie-players/pie-assessment-toolkit';
	import { BrowserTTSProvider, HighlightColor, TTSService } from '@pie-players/pie-assessment-toolkit';
	import { onMount } from 'svelte';

	interface Props {
		enabled?: boolean;
		highlightCoordinator?: HighlightCoordinator | null;
		ttsService: ITTSService;
		ondictionarylookup?: (detail: { text: string }) => void;
		ontranslationrequest?: (detail: { text: string }) => void;
	}

	let { enabled = true, highlightCoordinator = null, ttsService, ondictionarylookup, ontranslationrequest }: Props = $props();

	const isBrowser = typeof window !== 'undefined';

	let state = $state({
		visible: false,
		text: '',
		range: null as Range | null,
		pos: { x: 0, y: 0 }
	});

	async function ensureTts() {
		try {
			const provider = new BrowserTTSProvider();
			await ttsService.initialize(provider);
		} catch {
			// ignore
		}
	}

	function hide() {
		state.visible = false;
		state.text = '';
		state.range = null;
	}

	function showForSelection() {
		if (!enabled || !isBrowser) return;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0) return hide();
		const range = sel.getRangeAt(0);
		const text = sel.toString().trim();
		if (!text) return hide();

		const rect = range.getBoundingClientRect();
		state.visible = true;
		state.text = text;
		state.range = range.cloneRange();
		state.pos = { x: rect.left + rect.width / 2, y: rect.top - 8 };
	}

	function addHighlight(color: HighlightColor) {
		if (!state.range || !highlightCoordinator) return;
		highlightCoordinator.addAnnotation(state.range, color);
		hide();
	}

	function clearHighlights() {
		highlightCoordinator?.clearAnnotations();
		hide();
	}

	async function speak() {
		if (!state.text) return;
		await ensureTts();
		await ttsService.speak(state.text);
	}

	onMount(() => {
		const onMouseUp = () => showForSelection();
		const onKeyUp = () => showForSelection();
		const onScroll = () => hide();
		document.addEventListener('mouseup', onMouseUp);
		document.addEventListener('keyup', onKeyUp);
		window.addEventListener('scroll', onScroll, true);
		return () => {
			document.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('scroll', onScroll, true);
		};
	});
</script>

{#if state.visible}
	<div
		class="annotation-toolbar fixed z-[4200] flex gap-1 bg-base-100 shadow rounded-box p-1"
		style={`left:${state.pos.x}px; top:${state.pos.y}px; transform: translate(-50%, -100%);`}
		role="toolbar"
		aria-label="Annotation toolbar"
	>
		<button class="btn btn-xs" onclick={() => addHighlight(HighlightColor.YELLOW)} aria-label="Yellow highlight">Y</button>
		<button class="btn btn-xs" onclick={() => addHighlight(HighlightColor.PINK)} aria-label="Pink highlight">P</button>
		<button class="btn btn-xs" onclick={() => addHighlight(HighlightColor.BLUE)} aria-label="Blue highlight">B</button>
		<button class="btn btn-xs" onclick={() => addHighlight(HighlightColor.GREEN)} aria-label="Green highlight">G</button>

		<button class="btn btn-xs" onclick={speak} aria-label="Read selection">TTS</button>

		<button
			class="btn btn-xs"
			onclick={() => ondictionarylookup?.({ text: state.text })}
			aria-label="Dictionary lookup"
		>
			Dict
		</button>
		<button
			class="btn btn-xs"
			onclick={() => ontranslationrequest?.({ text: state.text })}
			aria-label="Translation request"
		>
			Trans
		</button>

		<button class="btn btn-xs btn-ghost" onclick={clearHighlights} aria-label="Clear highlights">Clear</button>
	</div>
{/if}
