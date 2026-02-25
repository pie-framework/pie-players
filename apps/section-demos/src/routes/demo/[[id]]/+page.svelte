<script lang="ts">
	
	import {
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';

	// Load the web component
	onMount(async () => {
		await Promise.all([
			import('@pie-players/pie-section-player'),
			import('@pie-players/pie-tool-annotation-toolbar')
		]);
	});
	import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

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
	let layoutType = $state<'vertical' | 'split-panel'>(getInitialLayoutType());
	let roleType = $state<'candidate' | 'scorer'>(getInitialMode());
	let toolbarPosition = $state<'top' | 'right' | 'bottom' | 'left'>('right');
	let layoutConfig = $state({ toolbarPosition: 'right' as 'top' | 'right' | 'bottom' | 'left' });
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let isSessionMinimized = $state(false);
	let isSourceMinimized = $state(false);
	let sectionPlayer: any = $state(null);
	let itemSessions = $state<Record<string, any>>({});
	let testAttemptSessionData = $state<any | null>(null);

	// Toolkit coordinator (owns all services)
	let toolkitCoordinator: any = $state(createDemoToolkitCoordinator());

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

	// Storage keys
	let SESSION_STORAGE_KEY = $derived(`pie-section-demo-sessions-${data.demo.id}`);
	let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
	let TTS_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-tts-config-${data.demo.id}`);
	let LAYOUT_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-layout-config-${data.demo.id}`);

	// Source panel state (read-only JSON view)
	let editedSourceJson = $state('');

	// Live section data (can be modified) - initialized in effect
	let liveSection: any = $state.raw({} as any);
	let previousDemoId = $state('');
	const DEFAULT_DEMO_PNP_PROFILE = {
		supports: [
			'calculator',
			'textToSpeech',
			'lineReader',
			'magnification',
			'screenMagnifier',
			'answerEliminator',
			'periodicTable',
			'protractor',
			'ruler',
			'graph'
		],
		prohibitedSupports: [],
		activateAtInit: []
	};

	let resolvedSectionForPlayer = $derived.by(() => {
		if (!liveSection) return liveSection;
		const hasExplicitPnp = Boolean(
			liveSection?.personalNeedsProfile || liveSection?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return liveSection;
		return {
			...liveSection,
			personalNeedsProfile: structuredClone(DEFAULT_DEMO_PNP_PROFILE)
		};
	});

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

	let pnpWindowX = $state(80);
	let pnpWindowY = $state(120);
	let pnpWindowWidth = $state(460);
	let pnpWindowHeight = $state(560);
	let isPnpMinimized = $state(false);
	let isPnpDragging = $state(false);
	let isPnpResizing = $state(false);

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

	function createDemoToolkitHooks(): ToolkitCoordinatorHooks {
		return {
			onError: (error, context) => {
				console.error('[Demo] Toolkit hook error:', context, error);
			},
			onTelemetry: (eventName, payload) => {
				console.log('[Demo] Toolkit telemetry:', eventName, payload);
			},
			loadToolState: () => {
				try {
					const saved = localStorage.getItem(TOOL_STATE_STORAGE_KEY);
					if (!saved) return null;
					const parsed = JSON.parse(saved);
					console.log('[Demo] Loaded tool state from localStorage');
					return parsed;
				} catch (e) {
					console.warn('[Demo] Failed to load tool state:', e);
					return null;
				}
			},
			saveToolState: (state) => {
				try {
					localStorage.setItem(TOOL_STATE_STORAGE_KEY, JSON.stringify(state));
				} catch (e) {
					console.warn('[Demo] Failed to persist tool state:', e);
				}
			}
		};
	}

	async function fetchDesmosAuthConfig() {
		const response = await fetch('/api/tools/desmos/auth');
		if (!response.ok) {
			throw new Error(`Desmos auth request failed (${response.status})`);
		}
		const payload = await response.json();
		return payload?.apiKey ? { apiKey: payload.apiKey } : {};
	}

	function createDemoToolkitCoordinator() {
		const coordinator = new ToolkitCoordinator({
			assessmentId: data.demo?.id || 'section-demo',
			lazyInit: true,
			tools: {
				floatingTools: {
					calculator: {
						provider: 'desmos',
						authFetcher: fetchDesmosAuthConfig
					}
				}
			}
		});
		coordinator.setHooks?.(createDemoToolkitHooks());
		return coordinator;
	}

	async function applyTTSConfig(config: TTSConfig) {
		if (!toolkitCoordinator) return;
		try {
			const backend = config.provider === 'browser' ? 'browser' : config.provider;
			toolkitCoordinator.updateToolConfig('tts', {
				enabled: true,
				backend,
				defaultVoice: config.voice || undefined,
				rate: config.rate,
				pitch: config.pitch,
				apiEndpoint: backend === 'browser' ? undefined : '/api/tts',
			});
			await toolkitCoordinator.ensureTTSReady();

			if (config.highlightStyle) {
				toolkitCoordinator.highlightCoordinator.updateTTSHighlightStyle(
					config.highlightStyle.color,
					config.highlightStyle.opacity
				);
			}

			console.log('[Demo] Toolkit TTS configured successfully');
		} catch (e) {
			console.error('[Demo] Failed to initialize TTS services:', e);
		}
	}

	// Initialize window positions on mount
	onMount(async () => {
		if (browser) {
			const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;

			// Session panel: centered and proportionally larger
			sessionWindowWidth = clamp(Math.round(viewportWidth * 0.58), 420, 980);
			sessionWindowHeight = clamp(Math.round(viewportHeight * 0.72), 360, 860);
			sessionWindowX = Math.max(16, Math.round((viewportWidth - sessionWindowWidth) / 2));
			sessionWindowY = Math.max(16, Math.round((viewportHeight - sessionWindowHeight) / 2));

			// Source panel: slightly larger than session for code editing
			sourceWindowWidth = clamp(Math.round(viewportWidth * 0.72), 640, 1200);
			sourceWindowHeight = clamp(Math.round(viewportHeight * 0.78), 420, 940);
			sourceWindowX = Math.max(16, Math.round((viewportWidth - sourceWindowWidth) / 2));
			sourceWindowY = Math.max(16, Math.round((viewportHeight - sourceWindowHeight) / 2));

			// PNP panel: medium size, centered
			pnpWindowWidth = clamp(Math.round(viewportWidth * 0.62), 460, 1040);
			pnpWindowHeight = clamp(Math.round(viewportHeight * 0.72), 360, 860);
			pnpWindowX = Math.max(16, Math.round((viewportWidth - pnpWindowWidth) / 2));
			pnpWindowY = Math.max(16, Math.round((viewportHeight - pnpWindowHeight) / 2));

			editedSourceJson = formatJsonForSourceView(data.section);

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

	// Sync layoutConfig with toolbarPosition changes
	$effect(() => {
		layoutConfig = { toolbarPosition };
	});

	$effect(() => {
		if (!toolkitCoordinator) return;
		void applyTTSConfig(ttsConfig);
	});

	// Update URL and refresh page when layout or mode changes
	function updateUrlAndRefresh(updates: { layout?: 'vertical' | 'split-panel'; mode?: 'candidate' | 'scorer' }) {
		if (browser) {
			const url = new URL(window.location.href);
			// Preserve current values and apply updates
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

	// Keep read-only source view in sync with current section
	$effect(() => {
		editedSourceJson = formatJsonForSourceView(liveSection);
	});

	onDestroy(() => {
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

	// Set complex properties imperatively on the web component
	// (Web components can only receive simple values via attributes)
	$effect(() => {
		if (sectionPlayer && liveSection) {
			untrack(() => {
				sectionPlayer.section = resolvedSectionForPlayer;
				sectionPlayer.env = pieEnv;
				sectionPlayer.toolkitCoordinator = toolkitCoordinator;
				sectionPlayer.itemSessions = itemSessions;
				sectionPlayer.toolbarPosition = toolbarPosition;
			});
		}
	});

	// Explicitly bind custom-event listener on the web component host.
	$effect(() => {
		if (!sectionPlayer) return;
		const listener = (event: Event) => handleSessionChanged(event as CustomEvent);
		sectionPlayer.addEventListener('session-changed', listener as EventListener);
		return () => {
			sectionPlayer.removeEventListener('session-changed', listener as EventListener);
		};
	});

	// Handle session changes from items
	function handleSessionChanged(event: CustomEvent) {
		console.log('[Demo] Session changed event:', event.detail);
		const { itemId, session, testAttemptSession } = event.detail;

		if (testAttemptSession) {
			testAttemptSessionData = testAttemptSession;
		}

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
		testAttemptSessionData = null;
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

	// PNP window dragging handlers
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

	// PNP window resize handlers
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

	let pnpPanelData = $derived.by(() => {
		const directProfile = liveSection?.personalNeedsProfile;
		const settingsProfile = liveSection?.settings?.personalNeedsProfile;
		const profile = directProfile || settingsProfile || DEFAULT_DEMO_PNP_PROFILE;
		const source = directProfile
			? 'section.personalNeedsProfile'
			: settingsProfile
				? 'section.settings.personalNeedsProfile'
				: 'demo default profile (derived)';

		const toolkitToolConfig = toolkitCoordinator?.config?.tools || null;
		const floatingTools = toolkitCoordinator?.getFloatingTools?.() || toolkitToolConfig?.floatingTools?.enabledTools || [];
		const hasCatalogResolver = Boolean(toolkitCoordinator?.catalogResolver);
		const catalogStats = hasCatalogResolver ? toolkitCoordinator.catalogResolver.getStatistics?.() : null;

		return {
			pnpProfile: profile,
			determination: {
				source,
				checked: [
					'section.personalNeedsProfile',
					'section.settings.personalNeedsProfile'
				],
				note: directProfile || settingsProfile
					? 'Profile was taken directly from section payload.'
					: 'No explicit PNP profile was found in section payload, so a demo default PNP profile is applied.',
				runtimeContext: {
					role: roleType,
					floatingToolsEnabled: floatingTools,
					hasCatalogResolver,
					catalogCount: catalogStats?.totalCatalogs ?? 0,
					assessmentCatalogCount: catalogStats?.assessmentCatalogs ?? 0,
					itemCatalogCount: catalogStats?.itemCatalogs ?? 0
				}
			}
		};
	});

	function decodeEscapedTextForDisplay(value: string): string {
		return value
			.replaceAll('\\r\\n', '\n')
			.replaceAll('\\n', '\n')
			.replaceAll('\\r', '\r')
			.replaceAll('\\t', '\t');
	}

	function normalizeContentForSourceView(value: any): any {
		if (typeof value === 'string') {
			return decodeEscapedTextForDisplay(value);
		}
		if (Array.isArray(value)) {
			return value.map(normalizeContentForSourceView);
		}
		if (value && typeof value === 'object') {
			const normalized: Record<string, any> = {};
			for (const [key, child] of Object.entries(value)) {
				normalized[key] = normalizeContentForSourceView(child);
			}
			return normalized;
		}
		return value;
	}

	function formatJsonForSourceView(value: any): string {
		return JSON.stringify(normalizeContentForSourceView(value), null, 2);
	}

	function copyJson() {
		if (browser) {
			navigator.clipboard.writeText(editedSourceJson);
		}
	}
</script>

<svelte:head>
	<title>{data.demo?.name || 'Demo'} - PIE Section Player</title>
</svelte:head>

<div class="w-full h-screen min-h-0 overflow-hidden flex flex-col">
	<!-- Menu Bar (Sticky) -->
	<div class="navbar bg-base-200 mb-0 sticky top-0 z-50 shadow-lg">
		<div class="navbar-start">
			<a href="/" class="btn btn-ghost btn-sm">&#8592; Back to Demos</a>
		</div>

		<div class="navbar-center flex gap-4 items-center">
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
				class="btn btn-sm btn-outline btn-square"
				class:btn-active={showSessionPanel}
				onclick={() => showSessionPanel = !showSessionPanel}
				title="Session"
				aria-label="Toggle session panel"
				aria-pressed={showSessionPanel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			</button>
			<button
				class="btn btn-sm btn-outline btn-square"
				class:btn-active={showSourcePanel}
				onclick={() => showSourcePanel = !showSourcePanel}
				title="Source"
				aria-label="Toggle source panel"
				aria-pressed={showSourcePanel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
			</button>
			<button
				class="btn btn-sm btn-outline btn-square"
				class:btn-active={showPnpPanel}
				onclick={() => showPnpPanel = !showPnpPanel}
				title="PNP profile"
				aria-label="Toggle PNP profile panel"
				aria-pressed={showPnpPanel}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
				</svg>
			</button>
		</div>
	</div>

	<div class="flex-1 min-h-0 overflow-hidden">
		<!-- Use web component - set complex properties imperatively via $effect -->
		<!-- svelte-ignore a11y_unknown_aria_attribute -->
		<pie-section-player
			class="block h-full min-h-0"
			bind:this={sectionPlayer}
			page-layout={layoutType}
			view={qtiView}
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
			<div class="p-4 flex flex-col min-h-0 overflow-hidden" style="height: {sessionWindowHeight - 60}px;">
				<div class="space-y-3 flex-1 min-h-0 flex flex-col">
					<!-- Session Data (Persistent - sent to server) -->
					<div class="mb-2">
						<div class="text-sm font-bold mb-2">PIE Session Data (Persistent)</div>
					</div>

					{#if !testAttemptSessionData && Object.keys(itemSessions).length === 0}
						<div class="alert alert-info">
							<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-xs">No session data yet. Interact with the questions to see updates.</span>
						</div>
					{:else}
						<div class="bg-base-200 rounded p-3 flex-1 min-h-0 flex flex-col">
							<div class="text-xs font-semibold mb-2">
								{testAttemptSessionData ? 'Test Attempt Session' : 'Item Sessions (Fallback)'}
							</div>
							<pre class="bg-base-300 p-2 rounded text-xs overflow-auto flex-1 min-h-0">{JSON.stringify(testAttemptSessionData || itemSessions, null, 2)}</pre>
						</div>
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
			<div class="flex flex-col overflow-hidden" style="height: {sourceWindowHeight - 50}px;">
				<!-- Toolbar -->
				<div class="flex items-center justify-between px-4 py-2 bg-base-200/50 border-b border-base-300">
					<div class="text-xs text-base-content/70">
						Read-only formatted JSON
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

				<!-- Read-only JSON -->
				<div class="flex-1 min-h-0 overflow-auto">
					<pre class="h-full w-full m-0 p-4 bg-base-300 text-xs font-mono overflow-auto whitespace-pre-wrap">{editedSourceJson}</pre>
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

<!-- Floating PNP Profile Window -->
{#if showPnpPanel}
	<div
		class="fixed z-100 bg-base-100 rounded-lg shadow-2xl border-2 border-base-300"
		style="left: {pnpWindowX}px; top: {pnpWindowY}px; width: {pnpWindowWidth}px; {isPnpMinimized ? 'height: auto;' : `height: ${pnpWindowHeight}px;`}"
	>
		<!-- Title Bar -->
		<div
			class="flex items-center justify-between px-4 py-2 bg-base-200 rounded-t-lg cursor-move select-none border-b border-base-300"
			onmousedown={startPnpDrag}
			role="button"
			tabindex="0"
			aria-label="Drag PNP profile panel"
		>
			<div class="flex items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v12a2 2 0 002 2zm1-12h4m-4 4h4m-4 4h4" />
				</svg>
				<h3 class="font-bold text-sm">PNP Profile</h3>
			</div>
			<div class="flex gap-1">
				<button
					class="btn btn-xs btn-ghost btn-circle"
					onclick={() => isPnpMinimized = !isPnpMinimized}
					title={isPnpMinimized ? 'Maximize' : 'Minimize'}
				>
					{#if isPnpMinimized}
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
					onclick={() => showPnpPanel = false}
					title="Close"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Content -->
		{#if !isPnpMinimized}
			<div class="p-4 overflow-y-auto" style="max-height: {pnpWindowHeight - 60}px;">
				<div class="space-y-3">
					<div class="bg-base-200 rounded p-3">
						<div class="text-xs font-semibold mb-2">Determination (read-only)</div>
						<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-56">{JSON.stringify(pnpPanelData.determination, null, 2)}</pre>
					</div>
					<div class="bg-base-200 rounded p-3">
						<div class="text-xs font-semibold mb-2">PNP Profile (read-only)</div>
						<pre class="bg-base-300 p-2 rounded text-xs overflow-auto max-h-72">{JSON.stringify(pnpPanelData.pnpProfile, null, 2)}</pre>
					</div>
				</div>
			</div>
		{/if}

		<!-- Resize Handle -->
		{#if !isPnpMinimized}
			<div
				class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
				onmousedown={startPnpResize}
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

