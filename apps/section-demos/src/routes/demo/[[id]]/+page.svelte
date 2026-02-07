<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import PieSectionPlayer from '@pie-players/pie-section-player/src/PieSectionPlayer.svelte';
	import type { PageData } from './$types';
	import { Editor } from '@tiptap/core';
	import Document from '@tiptap/extension-document';
	import Text from '@tiptap/extension-text';
	import History from '@tiptap/extension-history';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import { common, createLowlight } from 'lowlight';
	import {
		TTSService,
		BrowserTTSProvider,
		AccessibilityCatalogResolver,
		ToolCoordinator,
		HighlightCoordinator
	} from '@pie-players/pie-assessment-toolkit';
	import { ServerTTSProvider } from '@pie-players/tts-client-server';

	let { data }: { data: PageData } = $props();

	// Read URL params for initial state
	function getInitialPlayerType(): 'legacy' | 'iife' | 'esm' {
		if (browser) {
			const urlPlayerType = new URLSearchParams(window.location.search).get('player');
			if (urlPlayerType && ['legacy', 'iife', 'esm'].includes(urlPlayerType)) {
				return urlPlayerType as 'legacy' | 'iife' | 'esm';
			}
		}
		return 'legacy';
	}

	function getInitialLayoutType(): 'vertical' | 'split-panel' {
		if (browser) {
			const urlLayoutType = new URLSearchParams(window.location.search).get('layout');
			if (urlLayoutType && ['vertical', 'split-panel'].includes(urlLayoutType)) {
				return urlLayoutType as 'vertical' | 'split-panel';
			}
		}
		return 'split-panel';
	}

	let showJson = $state(false);
	let playerType = $state<'legacy' | 'iife' | 'esm'>(getInitialPlayerType());
	let layoutType = $state<'vertical' | 'split-panel'>(getInitialLayoutType());
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let isSessionMinimized = $state(false);
	let isSourceMinimized = $state(false);
	let sectionPlayer: any = $state(null);
	let itemSessions = $state<Record<string, any>>({});

	// TTS and toolkit services
	let ttsService: any = $state(null);
	let catalogResolver: any = $state(null);
	let toolCoordinator: any = $state(null);
	let highlightCoordinator: any = $state(null);
	let ttsProvider: 'polly' | 'browser' | 'loading' = $state('loading');

	// Storage key for sessions (derived to track data changes)
	let SESSION_STORAGE_KEY = $derived(`pie-section-demo-sessions-${data.demo.id}`);

	// Tiptap editor state
	let editorElement = $state<HTMLDivElement | null>(null);
	let editor: Editor | null = null;
	let editedSourceJson = $state('');
	let isSourceValid = $state(true);
	let sourceParseError = $state<string | null>(null);
	let hasSourceChanges = $state(false);
	const lowlight = browser ? createLowlight(common) : null;

	// Live section data (can be modified) - derived to track data changes
	let liveSection = $state.raw(structuredClone(data.section));

	// Sync liveSection when data.section changes
	$effect(() => {
		liveSection = structuredClone(data.section);
	});

	// Session window position and state
	let sessionWindowX = $state(0);
	let sessionWindowY = $state(100);
	let sessionWindowWidth = $state(400);
	let sessionWindowHeight = $state(600);
	let isSessionDragging = $state(false);
	let isSessionResizing = $state(false);

	// Source window position and state
	let sourceWindowX = $state(50);
	let sourceWindowY = $state(50);
	let sourceWindowWidth = $state(800);
	let sourceWindowHeight = $state(700);
	let isSourceDragging = $state(false);
	let isSourceResizing = $state(false);

	// Shared drag/resize state
	let dragStartX = 0;
	let dragStartY = 0;
	let dragStartWindowX = 0;
	let dragStartWindowY = 0;
	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	// Initialize window positions on mount
	onMount(async () => {
		if (browser) {
			sessionWindowX = window.innerWidth - 450;
			editedSourceJson = JSON.stringify(data.section, null, 2);

			// Load persisted sessions from localStorage
			try {
				const stored = localStorage.getItem(SESSION_STORAGE_KEY);
				if (stored) {
					itemSessions = JSON.parse(stored);
				}
			} catch (e) {
				console.error('Failed to load persisted sessions:', e);
			}

			// Initialize TTS and toolkit services
			try {
				ttsService = new TTSService();

				// Try server-side TTS with AWS Polly first (for speech marks and word highlighting)
				try {
					const serverProvider = new ServerTTSProvider();
					await ttsService.initialize(serverProvider, {
						apiEndpoint: '/api/tts',
						provider: 'polly',
						voice: 'Joanna',
						language: 'en-US',
						rate: 1.0,
					});
					ttsProvider = 'polly';
					console.log('[Demo] ✅ Server TTS initialized (AWS Polly with speech marks)');
				} catch (serverError) {
					console.warn('[Demo] Server TTS unavailable, falling back to browser TTS:', serverError);
					// Fallback to browser TTS
					const browserProvider = new BrowserTTSProvider();
					await ttsService.initialize(browserProvider);
					ttsProvider = 'browser';
					console.log('[Demo] ✅ Browser TTS initialized (fallback)');
				}

				catalogResolver = new AccessibilityCatalogResolver([], 'en-US');
				ttsService.setCatalogResolver(catalogResolver);

				toolCoordinator = new ToolCoordinator();
				highlightCoordinator = new HighlightCoordinator();

				// Set highlightCoordinator on TTS service for word highlighting
				ttsService.setHighlightCoordinator(highlightCoordinator);

				console.log('[Demo] All toolkit services initialized successfully');
			} catch (e) {
				console.error('[Demo] Failed to initialize TTS services:', e);
			}
		}
	});

	// Set services on player imperatively when ready (web component property binding)
	$effect(() => {
		if (browser && sectionPlayer && ttsService) {
			sectionPlayer.ttsService = ttsService;
			sectionPlayer.catalogResolver = catalogResolver;
			sectionPlayer.toolCoordinator = toolCoordinator;
			sectionPlayer.highlightCoordinator = highlightCoordinator;
			console.log('[Demo] Services set on section player');
		}
	});

	// Handle player type change with page refresh
	function handlePlayerChange(newPlayerType: 'legacy' | 'iife' | 'esm') {
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.set('player', newPlayerType);
			url.searchParams.set('layout', layoutType);
			window.location.href = url.toString();
		}
	}

	// Update URL when layoutType changes (without refresh)
	$effect(() => {
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.set('player', playerType);
			url.searchParams.set('layout', layoutType);
			replaceState(url.pathname + url.search, {});
		}
	});

	// Persist sessions to localStorage whenever they change
	$effect(() => {
		if (browser && Object.keys(itemSessions).length > 0) {
			try {
				localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(itemSessions));
			} catch (e) {
				console.error('Failed to persist sessions:', e);
			}
		}
	});

	// Initialize Tiptap editor when element is available
	$effect(() => {
		if (browser && lowlight && editorElement && !editor) {
			editor = new Editor({
				element: editorElement,
				extensions: [
					Document,
					Text,
					History,
					CodeBlockLowlight.configure({
						lowlight,
						defaultLanguage: 'json'
					})
				],
				content: `<pre><code class="language-json">${editedSourceJson}</code></pre>`,
				editorProps: {
					attributes: {
						class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4'
					}
				},
				onUpdate: ({ editor }) => {
					const text = editor.state.doc.textContent;
					editedSourceJson = text;
					try {
						JSON.parse(text);
						isSourceValid = true;
						sourceParseError = null;
						// Check if content has changed from original
						const originalJson = JSON.stringify(liveSection, null, 2);
						hasSourceChanges = text.trim() !== originalJson.trim();
					} catch (e: any) {
						isSourceValid = false;
						sourceParseError = e.message;
						hasSourceChanges = true;
					}
				}
			});
		}
	});

	onDestroy(() => {
		editor?.destroy();
	});

	// Compute player props based on selected type
	let playerProps = $derived.by(() => {
		switch (playerType) {
			case 'legacy':
				return { useLegacyPlayer: true, bundleHost: '', esmCdnUrl: '' };
			case 'iife':
				return { useLegacyPlayer: false, bundleHost: 'https://proxy.pie-api.com/bundles/', esmCdnUrl: '' };
			case 'esm':
				return { useLegacyPlayer: false, bundleHost: '', esmCdnUrl: 'https://esm.sh' };
		}
	});

	// Handle session changes from items
	function handleSessionChanged(event: CustomEvent) {
		console.log('[Demo] Session changed event:', event.detail);
		const { itemId, session } = event.detail;
		if (itemId && session) {
			console.log('[Demo] Updating itemSessions:', itemId, session);
			itemSessions = { ...itemSessions, [itemId]: session };
		} else {
			console.warn('[Demo] Missing itemId or session in event:', event.detail);
		}
	}

	// Reset all sessions
	function resetSessions() {
		itemSessions = {};
		if (browser) {
			try {
				localStorage.removeItem(SESSION_STORAGE_KEY);
			} catch (e) {
				console.error('Failed to clear persisted sessions:', e);
			}
		}
		// Force page reload to reset player state
		if (browser) {
			window.location.reload();
		}
	}

	// Session window dragging handlers
	function startSessionDrag(e: MouseEvent) {
		isSessionDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartWindowX = sessionWindowX;
		dragStartWindowY = sessionWindowY;

		document.addEventListener('mousemove', onSessionDrag);
		document.addEventListener('mouseup', stopSessionDrag);
	}

	function onSessionDrag(e: MouseEvent) {
		if (!isSessionDragging) return;

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		sessionWindowX = dragStartWindowX + deltaX;
		sessionWindowY = dragStartWindowY + deltaY;

		sessionWindowX = Math.max(0, Math.min(sessionWindowX, window.innerWidth - sessionWindowWidth));
		sessionWindowY = Math.max(0, Math.min(sessionWindowY, window.innerHeight - 100));
	}

	function stopSessionDrag() {
		isSessionDragging = false;
		document.removeEventListener('mousemove', onSessionDrag);
		document.removeEventListener('mouseup', stopSessionDrag);
	}

	// Source window dragging handlers
	function startSourceDrag(e: MouseEvent) {
		isSourceDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		dragStartWindowX = sourceWindowX;
		dragStartWindowY = sourceWindowY;

		document.addEventListener('mousemove', onSourceDrag);
		document.addEventListener('mouseup', stopSourceDrag);
	}

	function onSourceDrag(e: MouseEvent) {
		if (!isSourceDragging) return;

		const deltaX = e.clientX - dragStartX;
		const deltaY = e.clientY - dragStartY;

		sourceWindowX = dragStartWindowX + deltaX;
		sourceWindowY = dragStartWindowY + deltaY;

		sourceWindowX = Math.max(0, Math.min(sourceWindowX, window.innerWidth - sourceWindowWidth));
		sourceWindowY = Math.max(0, Math.min(sourceWindowY, window.innerHeight - 100));
	}

	function stopSourceDrag() {
		isSourceDragging = false;
		document.removeEventListener('mousemove', onSourceDrag);
		document.removeEventListener('mouseup', stopSourceDrag);
	}

	// Session window resize handlers
	function startSessionResize(e: MouseEvent) {
		isSessionResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartWidth = sessionWindowWidth;
		resizeStartHeight = sessionWindowHeight;

		document.addEventListener('mousemove', onSessionResize);
		document.addEventListener('mouseup', stopSessionResize);
		e.stopPropagation();
	}

	function onSessionResize(e: MouseEvent) {
		if (!isSessionResizing) return;

		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;

		sessionWindowWidth = Math.max(300, Math.min(resizeStartWidth + deltaX, window.innerWidth - sessionWindowX));
		sessionWindowHeight = Math.max(200, Math.min(resizeStartHeight + deltaY, window.innerHeight - sessionWindowY));
	}

	function stopSessionResize() {
		isSessionResizing = false;
		document.removeEventListener('mousemove', onSessionResize);
		document.removeEventListener('mouseup', stopSessionResize);
	}

	// Source window resize handlers
	function startSourceResize(e: MouseEvent) {
		isSourceResizing = true;
		resizeStartX = e.clientX;
		resizeStartY = e.clientY;
		resizeStartWidth = sourceWindowWidth;
		resizeStartHeight = sourceWindowHeight;

		document.addEventListener('mousemove', onSourceResize);
		document.addEventListener('mouseup', stopSourceResize);
		e.stopPropagation();
	}

	function onSourceResize(e: MouseEvent) {
		if (!isSourceResizing) return;

		const deltaX = e.clientX - resizeStartX;
		const deltaY = e.clientY - resizeStartY;

		sourceWindowWidth = Math.max(400, Math.min(resizeStartWidth + deltaX, window.innerWidth - sourceWindowX));
		sourceWindowHeight = Math.max(300, Math.min(resizeStartHeight + deltaY, window.innerHeight - sourceWindowY));
	}

	function stopSourceResize() {
		isSourceResizing = false;
		document.removeEventListener('mousemove', onSourceResize);
		document.removeEventListener('mouseup', stopSourceResize);
	}

	function copyJson() {
		if (browser) {
			navigator.clipboard.writeText(editedSourceJson);
		}
	}

	function applyChanges() {
		if (isSourceValid && hasSourceChanges) {
			try {
				const parsed = JSON.parse(editedSourceJson);
				// Update the live section data
				liveSection = parsed;
				// Clear item sessions when section changes to prevent stale data
				itemSessions = {};
				hasSourceChanges = false;
				console.log('Applied changes to section and cleared item sessions');
			} catch (e) {
				console.error('Failed to apply changes:', e);
			}
		}
	}

	function resetChanges() {
		if (browser && editor) {
			const original = JSON.stringify(liveSection, null, 2);
			editor.commands.setContent(`<pre><code class="language-json">${original}</code></pre>`);
			editedSourceJson = original;
			isSourceValid = true;
			sourceParseError = null;
			hasSourceChanges = false;
		}
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - PIE Section Player</title>
</svelte:head>

<div class="w-full h-screen flex flex-col">
	<!-- Menu Bar (Sticky) -->
	<div class="navbar bg-base-200 mb-0 sticky top-0 z-50 shadow-lg">
		<div class="navbar-start">
			<a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
		</div>

		<div class="navbar-center flex gap-4 items-center">
			<div class="join">
				<button
					class="btn btn-sm join-item"
					class:btn-active={playerType === 'legacy'}
					onclick={() => handlePlayerChange('legacy')}
				>
					Legacy
				</button>
				<button
					class="btn btn-sm join-item"
					class:btn-active={playerType === 'iife'}
					onclick={() => handlePlayerChange('iife')}
				>
					IIFE
				</button>
				<button
					class="btn btn-sm join-item"
					class:btn-active={playerType === 'esm'}
					onclick={() => handlePlayerChange('esm')}
				>
					ESM
				</button>
			</div>

			<div class="divider divider-horizontal"></div>

			<div class="join">
				<button
					class="btn btn-sm join-item"
					class:btn-active={layoutType === 'split-panel'}
					onclick={() => layoutType = 'split-panel'}
					title="Split panel - passages left, items right"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4m0-16v16m0-16h10a2 2 0 012 2v12a2 2 0 01-2 2H9" />
					</svg>
					Split
				</button>
				<button
					class="btn btn-sm join-item"
					class:btn-active={layoutType === 'vertical'}
					onclick={() => layoutType = 'vertical'}
					title="Vertical layout - passages first, then items"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
					Vertical
				</button>
			</div>

			<!-- TTS Provider Indicator -->
			<div class="badge badge-sm gap-1"
				class:badge-success={ttsProvider === 'polly'}
				class:badge-warning={ttsProvider === 'browser'}
				class:badge-ghost={ttsProvider === 'loading'}
			>
				{#if ttsProvider === 'loading'}
					<span class="loading loading-spinner loading-xs"></span>
					TTS Loading
				{:else if ttsProvider === 'polly'}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					AWS Polly
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828 2.828" />
					</svg>
					Browser TTS
				{/if}
			</div>
		</div>

		<div class="navbar-end gap-2">
			<button
				class="btn btn-sm btn-outline"
				onclick={() => showSessionPanel = !showSessionPanel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				Session
			</button>
			<button
				class="btn btn-sm btn-outline"
				onclick={() => showSourcePanel = !showSourcePanel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
				Source
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-hidden">
		<PieSectionPlayer
			bind:this={sectionPlayer}
			section={liveSection}
			layout={layoutType}
			mode="gather"
			view="candidate"
			itemSessions={itemSessions}
			{...playerProps}
			onsessionchanged={handleSessionChanged}
		/>
	</div>

</div>

<!-- Floating Session Window -->
{#if showSessionPanel}
	<div
		class="fixed z-[100] bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
		style="left: {sessionWindowX}px; top: {sessionWindowY}px; width: {sessionWindowWidth}px; {isSessionMinimized ? 'height: auto;' : `height: ${sessionWindowHeight}px;`}"
	>
		<!-- Title Bar -->
		<div
			class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
			onmousedown={startSessionDrag}
			role="button"
			tabindex="0"
			aria-label="Drag session panel"
		>
			<div class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
				<h3 class="font-bold text-sm">Session Data</h3>
			</div>
			<div class="flex gap-1">
				<button
					class="btn btn-xs btn-ghost btn-circle"
					onclick={() => isSessionMinimized = !isSessionMinimized}
					title={isSessionMinimized ? 'Maximize' : 'Minimize'}
				>
					{#if isSessionMinimized}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				<button
					class="btn btn-xs btn-ghost btn-circle"
					onclick={() => showSessionPanel = false}
					title="Close"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		{#if !isSessionMinimized}
			<div class="p-4 overflow-y-auto" style="max-height: {sessionWindowHeight - 60}px;">
				<div class="space-y-3">
					{#if Object.keys(itemSessions).length === 0}
						<div class="alert alert-info">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-xs">No session data yet. Interact with the questions to see updates.</span>
						</div>
					{:else}
						{#each Object.entries(itemSessions) as [itemId, session]}
							<div class="collapse collapse-arrow bg-base-200 collapse-sm">
								<input type="checkbox" />
								<div class="collapse-title text-sm font-medium min-h-0 py-2">
									Item: {itemId}
								</div>
								<div class="collapse-content">
									<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-48">{JSON.stringify(session, null, 2)}</pre>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Resize Handle -->
		{#if !isSessionMinimized}
			<div
				class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
				onmousedown={startSessionResize}
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
{/if}

<!-- Floating Source Window -->
{#if showSourcePanel}
	<div
		class="fixed z-[100] bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
		style="left: {sourceWindowX}px; top: {sourceWindowY}px; width: {sourceWindowWidth}px; {isSourceMinimized ? 'height: auto;' : `height: ${sourceWindowHeight}px;`}"
	>
		<!-- Title Bar -->
		<div
			class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
			onmousedown={startSourceDrag}
			role="button"
			tabindex="0"
			aria-label="Drag source panel"
		>
			<div class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
				<h3 class="font-bold text-sm">Source</h3>
			</div>
			<div class="flex gap-1">
				<button
					class="btn btn-xs btn-ghost btn-circle"
					onclick={() => isSourceMinimized = !isSourceMinimized}
					title={isSourceMinimized ? 'Maximize' : 'Minimize'}
				>
					{#if isSourceMinimized}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					{/if}
				</button>
				<button
					class="btn btn-xs btn-ghost btn-circle"
					onclick={() => showSourcePanel = false}
					title="Close"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		{#if !isSourceMinimized}
			<div class="flex flex-col" style="height: {sourceWindowHeight - 50}px;">
				<!-- Toolbar -->
				<div class="flex items-center justify-between px-4 py-2 bg-base-200/50 border-b border-base-300">
					<div class="text-xs text-base-content/70">
						{isSourceValid ? 'Valid JSON' : 'Invalid JSON'}
					</div>
					<div class="flex gap-2">
						<button
							class="btn btn-xs btn-ghost"
							onclick={copyJson}
							title="Copy to clipboard"
						>
							<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							Copy
						</button>
					</div>
				</div>

				<!-- Parse Error Alert -->
				{#if sourceParseError}
					<div class="mx-4 mt-2">
						<div class="alert alert-error alert-sm">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-xs">{sourceParseError}</span>
						</div>
					</div>
				{/if}

				<!-- Tiptap Editor -->
				<div class="flex-1 overflow-auto">
					<div
						bind:this={editorElement}
						class="border-none focus:outline-none bg-base-300 text-xs font-mono"
					></div>
				</div>
			</div>
		{/if}

		<!-- Resize Handle -->
		{#if !isSourceMinimized}
			<div
				class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
				onmousedown={startSourceResize}
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
{/if}
