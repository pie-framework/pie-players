<script lang="ts">
	
	import {
		ToolkitCoordinator,
		BrowserTTSProvider
	} from '@pie-players/pie-assessment-toolkit';
	import { ServerTTSProvider } from '@pie-players/tts-client-server';

	// Load the web component
	onMount(async () => {
		await import('@pie-players/pie-section-player');
	});
	import { Editor } from '@tiptap/core';
	import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
	import Document from '@tiptap/extension-document';
	import History from '@tiptap/extension-history';
	import Text from '@tiptap/extension-text';
	import { common, createLowlight } from 'lowlight';
import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { goto, onNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import AssessmentToolkitSettings from '$lib/components/AssessmentToolkitSettings.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Read URL params for initial state
	function getInitialPlayerType(): 'iife' | 'esm' {
		if (browser) {
			const urlPlayerType = new URLSearchParams(window.location.search).get('player');
			if (urlPlayerType && ['iife', 'esm'].includes(urlPlayerType)) {
				return urlPlayerType as 'iife' | 'esm';
			}
		}
		return 'iife';
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

	function getInitialMode(): 'candidate' | 'scorer' {
		if (browser) {
			const urlMode = new URLSearchParams(window.location.search).get('mode');
			if (urlMode && ['candidate', 'scorer'].includes(urlMode)) {
				return urlMode as 'candidate' | 'scorer';
			}
		}
		return 'candidate';
	}

	let showJson = $state(false);
	let playerType = $state<'iife' | 'esm'>(getInitialPlayerType());
	let layoutType = $state<'vertical' | 'split-panel'>(getInitialLayoutType());
	let roleType = $state<'candidate' | 'scorer'>(getInitialMode());
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let isSessionMinimized = $state(false);
	let isSourceMinimized = $state(false);
	let sectionPlayer: any = $state(null);
	let itemSessions = $state<Record<string, any>>({});
	let itemMetadata = $state<Record<string, { complete?: boolean; component?: string }>>({});

	// Toolkit coordinator (owns all services)
	let toolkitCoordinator: any = $state(null);
	let ttsProvider: 'polly' | 'browser' | 'google' | 'loading' = $state('loading');
	let showTTSSettings = $state(false);

	// TTS Configuration
	interface TTSConfig {
		provider: 'polly' | 'browser' | 'google';
		voice: string;
		rate: number;
		pitch: number;
		pollyEngine?: 'neural' | 'standard';
		pollySampleRate?: number;
		googleVoiceType?: 'wavenet' | 'standard' | 'studio';
	}

	let ttsConfig = $state<TTSConfig>({
		provider: 'polly',
		voice: 'Joanna',
		rate: 1.0,
		pitch: 1.0,
		pollyEngine: 'neural',
		pollySampleRate: 24000,
		googleVoiceType: 'wavenet',
	});

	// Highlighting Configuration
	let highlightConfig = $state({
		enabled: true,
		color: '#ffeb3b',
		opacity: 0.4
	});

	// Storage keys
	let SESSION_STORAGE_KEY = $derived(`pie-section-demo-sessions-${data.demo.id}`);
	let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
	let TTS_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-tts-config-${data.demo.id}`);
	let HIGHLIGHT_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-highlight-config-${data.demo.id}`);

	// Tiptap editor state
	let editorElement = $state<HTMLDivElement | null>(null);
	let editor: Editor | null = null;
	let editedSourceJson = $state('');
	let isSourceValid = $state(true);
	let sourceParseError = $state<string | null>(null);
	let hasSourceChanges = $state(false);
	const lowlight = browser ? createLowlight(common) : null;

	// Live section data (can be modified) - initialized in effect
	let liveSection: any = $state.raw({} as any);
	let previousDemoId = $state('');

	// Initialize and sync liveSection when data changes
	$effect(() => {
		const currentDemoId = data.demo.id;
		const currentSection = data.section;

		// Initialize on first run or update on navigation
		if (!previousDemoId || currentDemoId !== previousDemoId) {
			// Switching demos - clear tool state to prevent leakage
			if (previousDemoId && toolkitCoordinator) {
				toolkitCoordinator.elementToolStateStore.clearAll();
				console.log('[Demo] Cleared tool state when switching demos');
			}

			previousDemoId = currentDemoId;
			liveSection = structuredClone(currentSection);
		}
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

	// Initialize toolkit coordinator and TTS
	async function initializeTTS(config: TTSConfig) {
		ttsProvider = 'loading';

		try {
			// Create toolkit coordinator if not exists
			if (!toolkitCoordinator) {
				// Use demo ID to ensure uniqueness
				const assessmentId = `demo-${data.demo.id}`;

				toolkitCoordinator = new ToolkitCoordinator({
					assessmentId,
					tools: {
						tts: { enabled: true },
						answerEliminator: { enabled: true }
					},
					accessibility: {
						catalogs: [],
						language: 'en-US'
					}
				});

				// Set up tool state persistence
				toolkitCoordinator.elementToolStateStore.setOnStateChange((state: any) => {
					localStorage.setItem(TOOL_STATE_STORAGE_KEY, JSON.stringify(state));
				});

				// Load persisted tool state
				try {
					const saved = localStorage.getItem(TOOL_STATE_STORAGE_KEY);
					if (saved) {
						toolkitCoordinator.elementToolStateStore.loadState(JSON.parse(saved));
						console.log('[Demo] Loaded tool state from localStorage');
					}
				} catch (e) {
					console.warn('[Demo] Failed to load tool state:', e);
				}

				console.log('[Demo] ToolkitCoordinator created with assessmentId:', assessmentId);
			}

			// Get TTS service from coordinator
			const ttsService = toolkitCoordinator.ttsService;

			// Re-initialize TTS service with new provider
			if (config.provider === 'polly') {
				// Server-side TTS with AWS Polly
				const serverProvider = new ServerTTSProvider();
				await ttsService.initialize(serverProvider, {
					apiEndpoint: '/api/tts',
					provider: 'polly',
					voice: config.voice,
					language: 'en-US',
					rate: config.rate,
					pitch: config.pitch,
					providerOptions: {
						engine: config.pollyEngine || 'neural',
						sampleRate: config.pollySampleRate || 24000,
					},
				});
				ttsProvider = 'polly';
				console.log('[Demo] ✅ Server TTS initialized (AWS Polly):', {
					voice: config.voice,
					engine: config.pollyEngine,
					rate: config.rate,
					pitch: config.pitch,
				});
			} else if (config.provider === 'google') {
				// Server-side TTS with Google Cloud
				const serverProvider = new ServerTTSProvider();
				await ttsService.initialize(serverProvider, {
					apiEndpoint: '/api/tts',
					provider: 'google',
					voice: config.voice,
					language: 'en-US',
					rate: config.rate,
					pitch: config.pitch,
					providerOptions: {
						voiceType: config.googleVoiceType || 'wavenet',
					},
				});
				ttsProvider = 'google';
				console.log('[Demo] ✅ Server TTS initialized (Google Cloud):', {
					voice: config.voice,
					voiceType: config.googleVoiceType,
					rate: config.rate,
					pitch: config.pitch,
				});
			} else {
				// Browser TTS with timeout protection
				console.log('[Demo] Initializing Browser TTS with config:', {
					voice: config.voice,
					rate: config.rate,
					pitch: config.pitch,
				});

				const browserProvider = new BrowserTTSProvider();

				// Wrap initialization in a timeout to prevent infinite hangs
				const initPromise = ttsService.initialize(browserProvider, {
					voice: config.voice || undefined, // Don't pass empty string
					rate: config.rate,
					pitch: config.pitch,
				});

				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Browser TTS initialization timeout')), 5000)
				);

				await Promise.race([initPromise, timeoutPromise]);
				ttsProvider = 'browser';

				// Log available voices for debugging
				const availableVoices = speechSynthesis.getVoices();
				console.log('[Demo] ✅ Browser TTS initialized:', {
					voice: config.voice || 'default',
					rate: config.rate,
					pitch: config.pitch,
					availableVoices: availableVoices.length,
					voiceFound: availableVoices.some(v => v.name === config.voice)
				});
			}

			// Apply highlight style from config
			if (highlightConfig) {
				toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
					highlightConfig.color,
					highlightConfig.opacity
				);
			}

			console.log('[Demo] All toolkit services initialized successfully');
		} catch (e) {
			console.error('[Demo] Failed to initialize TTS services:', e);
			// On error, fall back to browser TTS (simpler, no recursion)
			ttsProvider = 'browser';
		}
	}

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

			// Load persisted TTS config
			try {
				const storedConfig = localStorage.getItem(TTS_CONFIG_STORAGE_KEY);
				if (storedConfig) {
					ttsConfig = JSON.parse(storedConfig);
					console.log('[Demo] Loaded TTS config from localStorage:', ttsConfig);
				}
			} catch (e) {
				console.error('Failed to load persisted TTS config:', e);
			}

			// Load persisted highlight config
			try {
				const storedHighlightConfig = localStorage.getItem(HIGHLIGHT_CONFIG_STORAGE_KEY);
				if (storedHighlightConfig) {
					highlightConfig = JSON.parse(storedHighlightConfig);
					console.log('[Demo] Loaded highlight config from localStorage:', highlightConfig);
				}
			} catch (e) {
				console.error('Failed to load persisted highlight config:', e);
			}

			// Initialize TTS with loaded/default configuration
			await initializeTTS(ttsConfig);
		}
	});

	// Handle settings apply (save and refresh page)
	async function handleUnifiedSettingsApply(settings: { tts: TTSConfig; highlight: typeof highlightConfig }) {
		console.log('[Demo] Unified settings applied:', settings);

		// Stop any currently playing TTS before reloading
		if (toolkitCoordinator) {
			try {
				toolkitCoordinator.ttsService.stop();
				console.log('[Demo] Stopped active TTS before config change');
			} catch (e) {
				console.error('[Demo] Failed to stop TTS:', e);
			}
		}

		// Update highlight coordinator with new style
		if (toolkitCoordinator && settings.highlight) {
			toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
				settings.highlight.color,
				settings.highlight.opacity
			);
		}

		// Persist to localStorage
		if (browser) {
			try {
				const ttsStorageKey = `pie-section-demo-tts-config-${data.demo.id}`;
				const highlightStorageKey = `pie-section-demo-highlight-config-${data.demo.id}`;

				localStorage.setItem(ttsStorageKey, JSON.stringify(settings.tts));
				localStorage.setItem(highlightStorageKey, JSON.stringify(settings.highlight));

				console.log('[Demo] Unified settings saved, refreshing page...');

				// Refresh the page to reinitialize with new config
				window.location.reload();
			} catch (e) {
				console.error('Failed to persist unified settings:', e);
			}
		}

		// Close modal
		showTTSSettings = false;
	}

	// Set toolkit coordinator on player imperatively when ready (web component property binding)
	$effect(() => {
		if (browser && sectionPlayer && toolkitCoordinator) {
			sectionPlayer.toolkitCoordinator = toolkitCoordinator;
			console.log('[Demo] ToolkitCoordinator set on section player');
		}
	});

	// Handle player type change with page refresh
	// Update URL and refresh page when player, layout, or mode changes
	function updateUrlAndRefresh(updates: { player?: 'iife' | 'esm'; layout?: 'vertical' | 'split-panel'; mode?: 'candidate' | 'scorer' }) {
		if (browser) {
			const url = new URL(window.location.href);
			// Preserve current values and apply updates
			url.searchParams.set('player', updates.player || playerType);
			url.searchParams.set('layout', updates.layout || layoutType);
			url.searchParams.set('mode', updates.mode || roleType);
			window.location.href = url.toString();
		}
	}

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

		// Stop TTS when component is destroyed (page navigation/refresh)
		if (toolkitCoordinator) {
			try {
				toolkitCoordinator.ttsService.stop();
				console.log('[Demo] Stopped TTS on component destroy');
			} catch (e) {
				console.error('[Demo] Failed to stop TTS on destroy:', e);
			}
		}
	});

	// Compute player props based on selected type
	// Map role toggle to PIE environment
	// candidate → gather mode + student role (interactive assessment)
	// scorer → evaluate mode + instructor role (scoring/review)
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});
	let qtiView = $derived<string>(roleType); // Keep QTI view for rubric filtering

	let playerProps = $derived.by(() => {
		switch (playerType) {
			case 'iife':
				return { bundleHost: 'https://proxy.pie-api.com/bundles/', esmCdnUrl: '' };
			case 'esm':
				return { bundleHost: '', esmCdnUrl: 'https://esm.sh' };
		}
	});

	// Set player configuration properties imperatively FIRST (before section/env)
	// Boolean attributes don't work correctly with Svelte custom elements
	$effect(() => {
		if (sectionPlayer) {
			untrack(() => {
				sectionPlayer.bundleHost = playerProps.bundleHost;
				sectionPlayer.esmCdnUrl = playerProps.esmCdnUrl;
			});
		}
	});

	// Set complex properties imperatively on the web component
	// (Web components can only receive simple values via attributes)
	$effect(() => {
		if (sectionPlayer && liveSection) {
			untrack(() => {
				sectionPlayer.section = liveSection;
				sectionPlayer.env = pieEnv;
				sectionPlayer.itemSessions = itemSessions;
			});
		}
	});

	// Handle session changes from items
	function handleSessionChanged(event: CustomEvent) {
		console.log('[Demo] Session changed event:', event.detail);
		const { itemId, session, complete, component } = event.detail;
		if (itemId && session) {
			console.log('[Demo] Updating itemSessions:', itemId, session);
			itemSessions = { ...itemSessions, [itemId]: session };

			// Store metadata separately
			itemMetadata = {
				...itemMetadata,
				[itemId]: { complete, component }
			};
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
					class:btn-active={playerType === 'iife'}
					onclick={() => updateUrlAndRefresh({ player: 'iife' })}
				>
					IIFE
				</button>
				<button
					class="btn btn-sm join-item"
					class:btn-active={playerType === 'esm'}
					onclick={() => updateUrlAndRefresh({ player: 'esm' })}
				>
					ESM
				</button>
			</div>

			<div class="divider divider-horizontal"></div>

			<div class="join">
				<button
					class="btn btn-sm join-item"
					class:btn-active={layoutType === 'split-panel'}
					onclick={() => updateUrlAndRefresh({ layout: 'split-panel' })}
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
					onclick={() => updateUrlAndRefresh({ layout: 'vertical' })}
					title="Vertical layout - passages first, then items"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
					Vertical
				</button>
			</div>

			<div class="divider divider-horizontal"></div>

			<div class="join">
				<button
					class="btn btn-sm join-item"
					class:btn-active={roleType === 'candidate'}
					onclick={() => updateUrlAndRefresh({ mode: 'candidate' })}
					title="Candidate view - student taking assessment (gather mode)"
				>
					Student
				</button>
				<button
					class="btn btn-sm join-item"
					class:btn-active={roleType === 'scorer'}
					onclick={() => updateUrlAndRefresh({ mode: 'scorer' })}
					title="Scorer view - instructor reviewing/scoring (evaluate mode)"
				>
					Scorer
				</button>
			</div>

		</div>

		<div class="navbar-end gap-2">
			<!-- Settings Button -->
			<button
				class="btn btn-sm btn-outline"
				onclick={() => showTTSSettings = true}
				title="Configure assessment toolkit settings"
			>
				{#if ttsProvider === 'loading'}
					<span class="loading loading-spinner loading-xs"></span>
					Loading
				{:else}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					Settings
				{/if}
			</button>
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
		<!-- Use web component - set complex properties imperatively via $effect -->
		<!-- svelte-ignore a11y_unknown_aria_attribute -->
		<pie-section-player
			bind:this={sectionPlayer}
			layout={layoutType}
			view={qtiView}
			bundle-host={playerProps.bundleHost}
			esm-cdn-url={playerProps.esmCdnUrl}
			onsessionchanged={handleSessionChanged}
		></pie-section-player>
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
					<!-- Tool State (Ephemeral - client only) -->
					{#if toolkitCoordinator}
						<div class="mb-4">
							<div class="text-sm font-bold mb-2 text-warning">Tool State (Ephemeral - Client Only)</div>
							<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-48">{JSON.stringify(toolkitCoordinator.elementToolStateStore.getAllState(), null, 2)}</pre>
						</div>
					{/if}

					<!-- Session Data (Persistent - sent to server) -->
					<div class="mb-2">
						<div class="text-sm font-bold mb-2">PIE Session Data (Persistent)</div>
					</div>

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
									{#if itemMetadata[itemId]?.complete !== undefined}
										<span class="badge badge-sm {itemMetadata[itemId].complete ? 'badge-success' : 'badge-ghost'} ml-2">
											{itemMetadata[itemId].complete ? 'Complete' : 'Incomplete'}
										</span>
									{/if}
								</div>
								<div class="collapse-content">
									<div class="space-y-2">
										<div>
											<div class="text-xs font-semibold mb-1">Session Data:</div>
											<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-48">{JSON.stringify(session, null, 2)}</pre>
										</div>
										{#if itemMetadata[itemId]}
											<div>
												<div class="text-xs font-semibold mb-1">Metadata:</div>
												<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-24">{JSON.stringify(itemMetadata[itemId], null, 2)}</pre>
											</div>
										{/if}
									</div>
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

<!-- Assessment Toolkit Settings Modal -->
{#if showTTSSettings && toolkitCoordinator}
	<AssessmentToolkitSettings
		ttsService={toolkitCoordinator.ttsService}
		bind:ttsConfig
		bind:highlightConfig
		onClose={() => showTTSSettings = false}
		onApply={handleUnifiedSettingsApply}
	/>
{/if}
