<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import {
		BrowserTTSProvider,
		HighlightCoordinator,
		ThemeProvider,
		ToolCoordinator,
		TTSService,
		TypedEventBus,
		type AssessmentToolkitEvents,
	} from '@pie-framework/pie-assessment-toolkit';
	import { responseDiscovery } from '@pie-framework/pie-assessment-toolkit/tools/client';

	type LogEntry = { ts: number; type: string; detail: any };

	const eventBus = new TypedEventBus<AssessmentToolkitEvents>();
	const toolCoordinator = new ToolCoordinator();
	const themeProvider = new ThemeProvider();
	const ttsService = new TTSService();
	const highlightCoordinator = new HighlightCoordinator();
	const highlightSupported = highlightCoordinator.isSupported();

	let log = $state<LogEntry[]>([]);

	// Theme (intent: accessible settings)
	let highContrast = $state(false);
	let fontSize = $state<'small' | 'medium' | 'large' | 'xlarge'>('medium');

	// Tool coordination demo (intent: predictable z-index + visibility)
	let toolAVisible = $state(false);
	let toolBVisible = $state(false);
	let toolAEl: HTMLElement | null = $state(null);
	let toolBEl: HTMLElement | null = $state(null);

	// Response discovery demo (intent: focus tracking + active response)
	let activeResponseId = $state<string | null>(null);
	let responseInputEl: HTMLInputElement | null = $state(null);
	let responseDiscoveryInitialized = $state(false);

	// TTS demo (intent: accessible controls, no keyboard traps)
	let ttsSupported = $state(true);
	const ttsText =
		'Text-to-speech intent demo: controls should be accessible, reversible, and not trap focus.';

	function pushLog(type: string, detail: any) {
		log = [{ ts: Date.now(), type, detail }, ...log].slice(0, 50);
	}

	function applyTheme() {
		themeProvider.applyTheme({
			highContrast,
			fontSize,
		} as any);
		pushLog('theme:applied', { highContrast, fontSize });
	}

	function coerceBool(v: string | null, fallback: boolean): boolean {
		if (v === null) return fallback;
		return v === '1' || v === 'true' || v === 'yes' || v === 'on';
	}
	function coerceFontSize(
		v: string | null,
		fallback: 'small' | 'medium' | 'large' | 'xlarge'
	): 'small' | 'medium' | 'large' | 'xlarge' {
		return v === 'small' || v === 'large' || v === 'xlarge' ? v : fallback;
	}

	// URL -> state (bookmarkable)
	$effect(() => {
		const q = $page.url.searchParams;

		const nextHighContrast = coerceBool(q.get('contrast'), untrack(() => highContrast));
		const nextFontSize = coerceFontSize(q.get('font'), untrack(() => fontSize));
		const nextToolA = coerceBool(q.get('toolA'), untrack(() => toolAVisible));
		const nextToolB = coerceBool(q.get('toolB'), untrack(() => toolBVisible));

		const themeChanged = nextHighContrast !== highContrast || nextFontSize !== fontSize;

		// Avoid tracking local state in this effect (it should only depend on URL).
		if (untrack(() => highContrast) !== nextHighContrast) highContrast = nextHighContrast;
		if (untrack(() => fontSize) !== nextFontSize) fontSize = nextFontSize;
		if (untrack(() => toolAVisible) !== nextToolA) toolAVisible = nextToolA;
		if (untrack(() => toolBVisible) !== nextToolB) toolBVisible = nextToolB;

		if (themeChanged) applyTheme();
	});

	// state -> URL (avoid pushing history)
	$effect(() => {
		const url = $page.url;
		const params = new URLSearchParams(url.searchParams);

		params.set('contrast', highContrast ? '1' : '0');
		params.set('font', fontSize);
		params.set('toolA', toolAVisible ? '1' : '0');
		params.set('toolB', toolBVisible ? '1' : '0');

		const nextSearch = params.toString();
		const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
		const currentUrl = `${url.pathname}${url.search}`;

		if (nextUrl !== currentUrl) {
			goto(nextUrl, { replaceState: true, keepFocus: true, noScroll: true });
		}
	});

	function emitSessionChanged() {
		eventBus.emit('player:session-changed', {
			itemId: 'demo-item',
			component: 'demo-component',
			complete: false,
			session: { id: 'local', data: [{ id: 'demo', value: 'x' }] },
			timestamp: Date.now(),
		});
	}

	function emitNavNext() {
		const payload = { direction: 'next' as const, timestamp: Date.now() };
		eventBus.emit('nav:next-requested', payload);
		pushLog('nav:next-requested', payload);
	}

	function saveState() {
		try {
			const payload = { ts: Date.now(), kind: 'demo' };
			localStorage.setItem('toolkit-evals:state', JSON.stringify(payload));
			eventBus.emit('state:saved', { type: 'assessment', timestamp: Date.now() });
			pushLog('state:saved', payload);
		} catch (e: any) {
			pushLog('state:save-failed', { error: e?.message ?? String(e) });
		}
	}

	function restoreState() {
		try {
			const raw = localStorage.getItem('toolkit-evals:state');
			const payload = raw ? JSON.parse(raw) : null;
			eventBus.emit('state:restored', { type: 'assessment', timestamp: Date.now() } as any);
			pushLog('state:restored', payload);
		} catch (e: any) {
			pushLog('state:restore-failed', { error: e?.message ?? String(e) });
		}
	}

	function toggleToolA() {
		toolAVisible = !toolAVisible;
		pushLog('tool:a:toggle', { visible: toolAVisible });
	}
	function toggleToolB() {
		toolBVisible = !toolBVisible;
		pushLog('tool:b:toggle', { visible: toolBVisible });
	}
	function bringToolAFront() {
		if (!toolAEl) return;
		toolCoordinator.bringToFront(toolAEl);
		pushLog('tool:a:front', {});
	}
	function bringToolBFront() {
		if (!toolBEl) return;
		toolCoordinator.bringToFront(toolBEl);
		pushLog('tool:b:front', {});
	}

	async function speak() {
		try {
			// Lazy init (browser API)
			const provider = new BrowserTTSProvider();
			await ttsService.initialize(provider);
			if (highlightSupported) {
				ttsService.setHighlightCoordinator(highlightCoordinator);
			}
			await ttsService.speak(ttsText);
			pushLog('tts:speak', { text: ttsText });
		} catch (e: any) {
			ttsSupported = false;
			pushLog('tts:unsupported', { error: e?.message ?? String(e) });
		}
	}

	function stop() {
		try {
			ttsService.stop();
			pushLog('tts:stop', {});
		} catch {}
	}

	function focusResponse() {
		responseInputEl?.focus();
	}

	function insertIntoResponse() {
		// Intent-only: we can’t guarantee real PIE responses implement PIEResponseComponent here.
		// We still show expected host wiring via an explicit UI action.
		const el = responseInputEl;
		if (!el) return;
		el.value = `${el.value}${el.value ? ' ' : ''}42`;
		el.dispatchEvent(new Event('input', { bubbles: true }));
		pushLog('response:insert', { value: el.value });
	}

	onMount(() => {
		applyTheme();

		// Wire event bus to log (intent: standard contracts)
		const sessionListener = (e: CustomEvent<any>) => pushLog('player:session-changed', e.detail);
		eventBus.on('player:session-changed', sessionListener as any);

		const navNextListener = (e: CustomEvent<any>) => pushLog('nav:next-requested', e.detail);
		eventBus.on('nav:next-requested', navNextListener as any);

		return () => {
			try {
				eventBus.off('player:session-changed', sessionListener as any);
				eventBus.off('nav:next-requested', navNextListener as any);
			} catch {}
		};
	});

	onDestroy(() => {
		try {
			toolCoordinator.unregisterTool('tool-a');
			toolCoordinator.unregisterTool('tool-b');
		} catch {}
	});

	// Register/unregister tool windows when they mount/unmount.
	$effect(() => {
		try {
			if (toolAVisible && toolAEl) {
				toolCoordinator.registerTool('tool-a', 'Tool A', toolAEl);
			} else {
				toolCoordinator.unregisterTool('tool-a');
			}
		} catch {}
	});
	$effect(() => {
		try {
			if (toolBVisible && toolBEl) {
				toolCoordinator.registerTool('tool-b', 'Tool B', toolBEl);
			} else {
				toolCoordinator.unregisterTool('tool-b');
			}
		} catch {}
	});

	// Register a deterministic “response” so responseDiscovery can track focus.
	$effect(() => {
		if (responseDiscoveryInitialized) return;
		if (!responseInputEl) return;

		responseDiscoveryInitialized = true;

		try {
			responseDiscovery.clear();
		} catch {}

		// Wire once
		responseDiscovery.onActiveResponseChanged((r) => {
			activeResponseId = r?.responseId ?? null;
			pushLog('response:active-changed', { responseId: activeResponseId });
		});
		responseDiscovery.setupFocusTracking();

		// Deterministic response registration
		try {
			responseDiscovery.registerResponse({
				responseId: 'demo-input',
				responseType: 'text',
				element: responseInputEl,
				getCapabilities: () => ({ supportedFormats: ['text'] }),
				insertContent: async (content: any) => {
					responseInputEl!.value = String(content);
				},
				getContent: async () => responseInputEl!.value,
			} as any);
		} catch {}

		pushLog('response:discovery-started', {});
	});
</script>

<svelte:head>
	<title>PIE Players - Evals: Assessment Toolkit</title>
</svelte:head>

<div class="container mx-auto px-6 py-6" data-testid="toolkit-root">
	<div class="prose max-w-none">
		<h1>Eval harness: assessment-toolkit</h1>
		<p>
			This page is a deterministic harness for validating <code>@pie-framework/pie-assessment-toolkit</code>
			intent and contracts (including accessibility intent). It is local-only and not part of static
			prerender output.
		</p>
	</div>

	<div class="mt-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
		<!-- Controls -->
		<div class="rounded-lg border border-base-300 bg-base-100 p-4 space-y-4">
			<div>
				<div class="font-semibold mb-2">Events (contracts)</div>
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-sm btn-primary" data-testid="emit-session-changed" onclick={emitSessionChanged}>
						Emit player:session-changed
					</button>
					<button class="btn btn-sm" data-testid="emit-nav-next" onclick={emitNavNext}>
						Emit nav:next-requested
					</button>
					<button class="btn btn-sm" data-testid="save-state" onclick={saveState}>
						Save state
					</button>
					<button class="btn btn-sm" data-testid="restore-state" onclick={restoreState}>
						Restore state
					</button>
				</div>
			</div>

			<div>
				<div class="font-semibold mb-2">Theme (a11y intent)</div>
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						class="toggle toggle-sm"
						bind:checked={highContrast}
						aria-label="Toggle high contrast"
						data-testid="toggle-high-contrast"
						onchange={applyTheme}
					/>
					<span class="text-sm">High contrast</span>
				</label>

				<label class="block mt-3 text-sm">
					<span class="opacity-70">Font size</span>
					<select
						class="select select-bordered select-sm w-full mt-1"
						bind:value={fontSize}
						aria-label="Select font size"
						data-testid="select-font-size"
						onchange={applyTheme}
					>
						<option value="small">small</option>
						<option value="medium">medium</option>
						<option value="large">large</option>
						<option value="xlarge">xlarge</option>
					</select>
				</label>
			</div>

			<div>
				<div class="font-semibold mb-2">Tools (coordination intent)</div>
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-sm" data-testid="toggle-tool-a" onclick={toggleToolA}>Toggle Tool A</button>
					<button class="btn btn-sm" data-testid="toggle-tool-b" onclick={toggleToolB}>Toggle Tool B</button>
				</div>
				<p class="text-xs opacity-70 mt-2">
					Intent: tools are keyboard accessible, can be brought to front, and do not trap focus.
				</p>
			</div>

			<div>
				<div class="font-semibold mb-2">Response discovery (intent)</div>
				<div class="space-y-2">
					<input
						bind:this={responseInputEl}
						type="text"
						class="input input-bordered input-sm w-full"
						placeholder="Focus me (response target)"
						aria-label="Response input"
						data-testid="response-input"
						value=""
					/>
					<div class="flex gap-2">
						<button class="btn btn-sm" data-testid="focus-response" onclick={focusResponse}>Focus</button>
						<button class="btn btn-sm" data-testid="insert-into-response" onclick={insertIntoResponse}>Insert “42”</button>
					</div>
					<div class="text-xs opacity-70">
						Active response id: <code data-testid="active-response-id">{activeResponseId ?? ''}</code>
					</div>
				</div>
			</div>

			<div>
				<div class="font-semibold mb-2">TTS (intent)</div>
				<div class="flex flex-wrap gap-2">
					<button class="btn btn-sm btn-secondary" data-testid="tts-speak" onclick={speak} disabled={!ttsSupported}>
						Speak
					</button>
					<button class="btn btn-sm" data-testid="tts-stop" onclick={stop}>Stop</button>
				</div>
				{#if !ttsSupported}
					<p class="text-xs opacity-70 mt-2">
						TTS not supported in this environment (local-only capability).
					</p>
				{/if}
			</div>
		</div>

		<!-- Workspace + log -->
		<div class="rounded-lg border border-base-300 bg-base-100 p-4">
			<div class="font-semibold mb-2">Event log</div>
			<pre class="text-xs overflow-auto max-h-[520px] bg-base-200 p-3 rounded" data-testid="event-log">{JSON.stringify(log, null, 2)}</pre>

			<!-- Tool windows (rendered in-flow but styled as floating) -->
			{#if toolAVisible}
				<div
					bind:this={toolAEl}
					tabindex="0"
					role="dialog"
					aria-label="Tool A window"
					class="mt-4 rounded border border-base-300 bg-base-100 p-3 shadow"
					style="position: relative;"
					data-testid="tool-a"
					onmousedown={bringToolAFront}
					onfocus={bringToolAFront}
				>
					<div class="flex items-center justify-between">
						<div class="font-semibold">Tool A</div>
						<button class="btn btn-xs" data-testid="front-tool-a" onclick={bringToolAFront}>Front</button>
					</div>
					<p class="text-xs opacity-70 mt-2">
						Intent: bring-to-front doesn’t require a mouse and doesn’t break focus order.
					</p>
				</div>
			{/if}

			{#if toolBVisible}
				<div
					bind:this={toolBEl}
					tabindex="0"
					role="dialog"
					aria-label="Tool B window"
					class="mt-4 rounded border border-base-300 bg-base-100 p-3 shadow"
					style="position: relative;"
					data-testid="tool-b"
					onmousedown={bringToolBFront}
					onfocus={bringToolBFront}
				>
					<div class="flex items-center justify-between">
						<div class="font-semibold">Tool B</div>
						<button class="btn btn-xs" data-testid="front-tool-b" onclick={bringToolBFront}>Front</button>
					</div>
					<p class="text-xs opacity-70 mt-2">
						Intent: tool layering is deterministic and reversible.
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>


