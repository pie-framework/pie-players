<script lang="ts">
	
	import {
		ToolkitCoordinator,
		BrowserTTSProvider,
		AnnotationToolbarAPIClient
	} from '@pie-players/pie-assessment-toolkit';
	import { ServerTTSProvider } from '@pie-players/tts-client-server';

	// Load the web component
	onMount(async () => {
		await Promise.all([
			import('@pie-players/pie-section-player'),
			import('@pie-players/pie-tool-annotation-toolbar')
		]);
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

	function getInitialEsmSource(): 'local' | 'remote' {
		if (browser) {
			const urlParam = new URLSearchParams(window.location.search).get('esmSource');
			if (urlParam === 'local') {
				return 'local';
			}
		}
		return 'remote';
	}

	let showJson = $state(false);
	let playerType = $state<'iife' | 'esm'>(getInitialPlayerType());
	let layoutType = $state<'vertical' | 'split-panel'>(getInitialLayoutType());
	let roleType = $state<'candidate' | 'scorer'>(getInitialMode());
	let esmSource = $state<'local' | 'remote'>(getInitialEsmSource());
	let toolbarPosition = $state<'top' | 'right' | 'bottom' | 'left'>('right');
	let layoutConfig = $state({ toolbarPosition: 'right' as 'top' | 'right' | 'bottom' | 'left' });
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let isSessionMinimized = $state(false);
	let isSourceMinimized = $state(false);
	let sectionPlayer: any = $state(null);
	let itemSessions = $state<Record<string, any>>({});
	let itemMetadata = $state<Record<string, { complete?: boolean; component?: string }>>({});

	// Toolkit coordinator (owns all services)
	let toolkitCoordinator: any = $state(null);

	// TTS Configuration
	interface TTSHighlightStyle {
		color: string;
		opacity: number;
	}

	interface TTSConfig {
		provider: 'polly' | 'browser' | 'google';
		voice: string;
		rate: number;
		pitch: number;
		pollyEngine?: 'neural' | 'standard';
		pollySampleRate?: number;
		googleVoiceType?: 'wavenet' | 'standard' | 'studio';
		highlightStyle?: TTSHighlightStyle;
	}

	function getDefaultTTSConfig(): TTSConfig {
		return {
			provider: 'browser',
			voice: '',
			rate: 1.0,
			pitch: 1.0,
			highlightStyle: {
				color: '#ffeb3b',
				opacity: 0.4
			}
		};
	}

	let ttsConfig = $state<TTSConfig>(getDefaultTTSConfig());

	// Annotation Toolbar API Client (for dictionary/translation features)
	const annotationAPIClient = browser ? new AnnotationToolbarAPIClient({
		dictionaryEndpoint: '/api/dictionary',
		pictureDictionaryEndpoint: '/api/picture-dictionary',
		translationEndpoint: '/api/translation',
		defaultLanguage: 'en-us'
	}) : null;

	// Dialog state for dictionary/translation features
	let dictionaryDialog = $state<{
		open: boolean;
		keyword: string;
		language: string;
		definitions: Array<{
			partOfSpeech: string;
			definition: string;
			example?: string;
		}>;
	}>({
		open: false,
		keyword: '',
		language: '',
		definitions: []
	});

	let pictureDictionaryDialog = $state<{
		open: boolean;
		keyword: string;
		images: Array<{ image: string }>;
	}>({
		open: false,
		keyword: '',
		images: []
	});

	let translationDialog = $state<{
		open: boolean;
		originalText: string;
		translatedText: string;
		sourceLanguage: string;
		targetLanguage: string;
	}>({
		open: false,
		originalText: '',
		translatedText: '',
		sourceLanguage: '',
		targetLanguage: ''
	});

	// Storage keys
	let SESSION_STORAGE_KEY = $derived(`pie-section-demo-sessions-${data.demo.id}`);
	let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
	let TTS_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-tts-config-${data.demo.id}`);
	let LAYOUT_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-layout-config-${data.demo.id}`);

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

	// Outer scrollbar: show only while scrolling (cleaned up in onDestroy)
	let outerScrollTimeoutId: ReturnType<typeof setTimeout> | null = null;
	let removeOuterScrollListener: (() => void) | null = null;

	// Initialize toolkit coordinator and TTS
	async function initializeTTS(config: TTSConfig) {
		try {
			// Create toolkit coordinator if not exists
			if (!toolkitCoordinator) {
				// Use demo ID to ensure uniqueness
				const assessmentId = `demo-${data.demo.id}`;

				// Default floating tools list for demo mode
				const defaultToolsList = [
					'calculator',
					'calculatorScientific',
					'calculatorGraphing',
					'graph',
					'periodicTable',
					'protractor',
					'ruler',
					'lineReader',
					'magnifier',
					'screenMagnifier',
					'textToSpeech',
					'answerEliminator'
				];

				toolkitCoordinator = new ToolkitCoordinator({
					assessmentId,
					tools: {
						tts: { enabled: true },
						answerEliminator: { enabled: true },
						floatingTools: {
							enabledTools: defaultToolsList,
							calculator: {
								enabled: true,
								provider: 'desmos',
								authFetcher: async () => {
									const response = await fetch('/api/tools/desmos/auth');
									if (!response.ok) {
										throw new Error(
											`Failed to load Desmos auth config: ${response.status} ${response.statusText}`
										);
									}
									const authConfig = await response.json();
									return {
										apiKey: authConfig?.apiKey || undefined
									};
								}
							},
							graph: { enabled: true },
							periodicTable: { enabled: true },
							protractor: { enabled: true },
							ruler: { enabled: true },
							lineReader: { enabled: true },
							magnifier: { enabled: true },
							colorScheme: { enabled: true }
						}
					},
					accessibility: {
						catalogs: [],
						language: 'en-US'
					}
				});

				// Calculator provider is automatically registered by ToolkitCoordinator
				// No manual registration needed - it handles Desmos provider creation

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

			// Apply TTS highlight style from config
			if (config.highlightStyle) {
				toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
					config.highlightStyle.color,
					config.highlightStyle.opacity
				);
			}

			console.log('[Demo] All toolkit services initialized successfully');
		} catch (e) {
			console.error('[Demo] Failed to initialize TTS services:', e);
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
					const parsedConfig = JSON.parse(storedConfig);
					ttsConfig = {
						...getDefaultTTSConfig(),
						...parsedConfig,
						highlightStyle: {
							...getDefaultTTSConfig().highlightStyle,
							...(parsedConfig?.highlightStyle || {})
						}
					};
					console.log(
						'[Demo] Loaded TTS config from localStorage:',
						$state.snapshot(ttsConfig)
					);
				}
			} catch (e) {
				console.error('Failed to load persisted TTS config:', e);
			}

			// Load persisted layout config
			try {
				const storedLayoutConfig = localStorage.getItem(LAYOUT_CONFIG_STORAGE_KEY);
				if (storedLayoutConfig) {
					const parsed = JSON.parse(storedLayoutConfig);
					layoutConfig = parsed;
					toolbarPosition = parsed.toolbarPosition;
					console.log(
						'[Demo] Loaded layout config from localStorage:',
						$state.snapshot(layoutConfig)
					);
				}
			} catch (e) {
				console.error('Failed to load persisted layout config:', e);
			}

			// Initialize TTS with loaded/default configuration
			await initializeTTS(ttsConfig);

			// Outer scrollbar: show only while the user is scrolling
			function markOuterScrolling() {
				document.documentElement.classList.add('outer-scrolling');
				document.body.classList.add('outer-scrolling');
				if (outerScrollTimeoutId) clearTimeout(outerScrollTimeoutId);
				outerScrollTimeoutId = setTimeout(() => {
					document.documentElement.classList.remove('outer-scrolling');
					document.body.classList.remove('outer-scrolling');
					outerScrollTimeoutId = null;
				}, 700);
			}
			window.addEventListener('scroll', markOuterScrolling, { passive: true });
			removeOuterScrollListener = () => {
				window.removeEventListener('scroll', markOuterScrolling);
				if (outerScrollTimeoutId) clearTimeout(outerScrollTimeoutId);
			};
		}
	});

	// Set toolkit coordinator on player imperatively when ready (web component property binding)
	$effect(() => {
		if (browser && sectionPlayer && toolkitCoordinator) {
			sectionPlayer.toolkitCoordinator = toolkitCoordinator;
			console.log('[Demo] ToolkitCoordinator set on section player');
		}
	});

	// Sync layoutConfig with toolbarPosition changes
	$effect(() => {
		layoutConfig = { toolbarPosition };
	});

	// Handle player type change with page refresh
	// Update URL and refresh page when player, layout, or mode changes
	function updateUrlAndRefresh(updates: { player?: 'iife' | 'esm'; layout?: 'vertical' | 'split-panel'; mode?: 'candidate' | 'scorer'; esmSource?: 'local' | 'remote' }) {
		if (browser) {
			const url = new URL(window.location.href);
			// Preserve current values and apply updates
			url.searchParams.set('player', updates.player || playerType);
			url.searchParams.set('layout', updates.layout || layoutType);
			url.searchParams.set('mode', updates.mode || roleType);
			url.searchParams.set('esmSource', updates.esmSource || esmSource);
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

		// Remove outer scrollbar listener and class
		if (removeOuterScrollListener) {
			removeOuterScrollListener();
			removeOuterScrollListener = null;
		}
		document.documentElement.classList.remove('outer-scrolling');
		document.body.classList.remove('outer-scrolling');

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

	// Compute player definitions for selected type/source
	// Map role toggle to PIE environment
	// candidate → gather mode + student role (interactive assessment)
	// scorer → evaluate mode + instructor role (scoring/review)
	let pieEnv = $derived<{ mode: 'gather' | 'view' | 'evaluate'; role: 'student' | 'instructor' }>({
		mode: roleType === 'candidate' ? 'gather' : 'evaluate',
		role: roleType === 'candidate' ? 'student' : 'instructor'
	});
	let qtiView = $derived<string>(roleType); // Keep QTI view for rubric filtering

	let playerDefinitions = $derived.by(() => ({
		iife: {
			tagName: 'pie-iife-player',
			attributes: {
				'bundle-host': 'https://proxy.pie-api.com/bundles'
			}
		},
		esm: {
			tagName: 'pie-esm-player',
			attributes: {
				'esm-cdn-url': esmSource === 'local' ? '' : 'https://esm.sh'
			}
		}
	}));

	// Set complex properties imperatively on the web component
	// (Web components can only receive simple values via attributes)
	$effect(() => {
		if (sectionPlayer && liveSection) {
			untrack(() => {
				sectionPlayer.section = liveSection;
				sectionPlayer.env = pieEnv;
				sectionPlayer.itemSessions = itemSessions;
				sectionPlayer.toolkitCoordinator = toolkitCoordinator;
				sectionPlayer.toolbarPosition = toolbarPosition;
				sectionPlayer.playerDefinitions = playerDefinitions;
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

			{#if playerType === 'esm'}
				<div class="join">
					<button
						class="btn btn-sm join-item"
						class:btn-active={esmSource === 'remote'}
						onclick={() => updateUrlAndRefresh({ esmSource: 'remote' })}
						title="Use remote CDN (esm.sh)"
					>
						Remote CDN
					</button>
					<button
						class="btn btn-sm join-item"
						class:btn-active={esmSource === 'local'}
						onclick={() => updateUrlAndRefresh({ esmSource: 'local' })}
						title="Use local-esm-cdn (prod testing)"
					>
						Local CDN
					</button>
				</div>
			{/if}

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
			player={playerType}
			page-layout={layoutType}
			view={qtiView}
			onsessionchanged={handleSessionChanged}
		></pie-section-player>
	</div>

</div>

<!-- Annotation Toolbar (floating, appears on text selection) -->
<!-- Outside main container to avoid overflow: hidden affecting fixed positioning -->
{#if toolkitCoordinator}
	<pie-tool-annotation-toolbar
		enabled={true}
		ttsService={toolkitCoordinator.ttsService}
		highlightCoordinator={toolkitCoordinator.highlightCoordinator}
		ondictionarylookup={async (detail: { text: string }) => {
			console.log('Dictionary lookup:', detail.text);
			if (!annotationAPIClient) return;
			try {
				const result = await annotationAPIClient.lookupDictionary(detail.text);
				console.log('Dictionary result:', result);
				dictionaryDialog = {
					open: true,
					keyword: result.keyword,
					language: result.language,
					definitions: result.definitions
				};
			} catch (error) {
				console.error('Dictionary lookup failed:', error);
				alert(`Dictionary lookup failed: ${error}`);
			}
		}}
		ontranslationrequest={async (detail: { text: string }) => {
			console.log('Translation request:', detail.text);
			if (!annotationAPIClient) return;
			try {
				const result = await annotationAPIClient.translate(detail.text, 'es'); // Translate to Spanish
				console.log('Translation result:', result);
				translationDialog = {
					open: true,
					originalText: result.text,
					translatedText: result.translatedText,
					sourceLanguage: result.sourceLanguage,
					targetLanguage: result.targetLanguage
				};
			} catch (error) {
				console.error('Translation failed:', error);
				alert(`Translation failed: ${error}`);
			}
		}}
		onpicturedictionarylookup={async (detail: { text: string }) => {
			console.log('Picture dictionary lookup:', detail.text);
			if (!annotationAPIClient) return;
			try {
				const result = await annotationAPIClient.lookupPictureDictionary(detail.text, undefined, 10);
				console.log('Picture dictionary result:', result);
				pictureDictionaryDialog = {
					open: true,
					keyword: detail.text,
					images: result.images
				};
			} catch (error) {
				console.error('Picture dictionary lookup failed:', error);
				alert(`Picture dictionary lookup failed: ${error}`);
			}
		}}
	></pie-tool-annotation-toolbar>
{/if}

<!-- Floating Session Window -->
{#if showSessionPanel}
	<div
		class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
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
		class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
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

<!-- Dictionary Dialog -->
{#if dictionaryDialog.open}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}
				>✕</button>
			</form>
			<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
				</svg>
				Dictionary: <span class="text-primary">{dictionaryDialog.keyword}</span>
			</h3>

			<div class="space-y-4">
				{#each dictionaryDialog.definitions as definition, i}
					<div class="card bg-base-200">
						<div class="card-body p-4">
							<div class="badge badge-primary badge-sm mb-2">{definition.partOfSpeech}</div>
							<p class="text-base">{definition.definition}</p>
							{#if definition.example}
								<div class="mt-2 pl-4 border-l-2 border-primary/30">
									<p class="text-sm text-base-content/70 italic">
										Example: "{definition.example}"
									</p>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="modal-action">
				<button
					class="btn btn-primary"
					onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}
				>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => dictionaryDialog = { ...dictionaryDialog, open: false }}>close</button>
		</form>
	</dialog>
{/if}

<!-- Picture Dictionary Dialog -->
{#if pictureDictionaryDialog.open}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-4xl">
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					onclick={() => pictureDictionaryDialog = { ...pictureDictionaryDialog, open: false }}
				>✕</button>
			</form>
			<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				Picture Dictionary: <span class="text-primary">{pictureDictionaryDialog.keyword}</span>
			</h3>

			{#if pictureDictionaryDialog.images.length === 0}
				<div class="alert alert-info">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					<span>No images found for "{pictureDictionaryDialog.keyword}"</span>
				</div>
			{:else}
				<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
					{#each pictureDictionaryDialog.images as img, i}
						<div class="card bg-base-200 shadow-xl">
							<figure class="px-4 pt-4">
								<img
									src={img.image}
									alt="{pictureDictionaryDialog.keyword} - Image {i + 1}"
									class="rounded-xl w-full h-48 object-cover"
									onerror={(e) => {
										const target = e.currentTarget as HTMLImageElement | null;
										if (target) {
											target.src = "https://via.placeholder.com/200x200/cccccc/666666?text=Image+Not+Found";
										}
									}}
								/>
							</figure>
						</div>
					{/each}
				</div>
			{/if}

			<div class="modal-action">
				<button
					class="btn btn-primary"
					onclick={() => pictureDictionaryDialog = { ...pictureDictionaryDialog, open: false }}
				>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => pictureDictionaryDialog = { ...pictureDictionaryDialog, open: false }}>close</button>
		</form>
	</dialog>
{/if}

<!-- Translation Dialog -->
{#if translationDialog.open}
	<dialog class="modal modal-open">
		<div class="modal-box max-w-2xl">
			<form method="dialog">
				<button
					class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
					onclick={() => translationDialog = { ...translationDialog, open: false }}
				>✕</button>
			</form>
			<h3 class="font-bold text-lg mb-4 flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
				</svg>
				Translation
			</h3>

			<div class="space-y-4">
				<div class="card bg-base-200">
					<div class="card-body p-4">
						<div class="flex items-center gap-2 mb-2">
							<div class="badge badge-outline">{translationDialog.sourceLanguage.toUpperCase()}</div>
							<span class="text-xs text-base-content/50">Original</span>
						</div>
						<p class="text-base">{translationDialog.originalText}</p>
					</div>
				</div>

				<div class="flex justify-center">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
					</svg>
				</div>

				<div class="card bg-primary/10 border-2 border-primary/20">
					<div class="card-body p-4">
						<div class="flex items-center gap-2 mb-2">
							<div class="badge badge-primary">{translationDialog.targetLanguage.toUpperCase()}</div>
							<span class="text-xs text-base-content/50">Translation</span>
						</div>
						<p class="text-base font-medium">{translationDialog.translatedText}</p>
					</div>
				</div>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-primary"
					onclick={() => translationDialog = { ...translationDialog, open: false }}
				>Close</button>
			</div>
		</div>
		<form method="dialog" class="modal-backdrop">
			<button onclick={() => translationDialog = { ...translationDialog, open: false }}>close</button>
		</form>
	</dialog>
{/if}
