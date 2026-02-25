<script lang="ts">
	
	import {
		createDefaultPersonalNeedsProfile,
		ToolkitCoordinator,
		type ToolkitCoordinatorHooks
	} from '@pie-players/pie-assessment-toolkit';

	// Load the web component
	onMount(async () => {
		await Promise.all([
			import('@pie-players/pie-section-player'),
			import('@pie-players/pie-tool-annotation-toolbar'),
			import('@pie-players/pie-section-player-tools-session-debugger'),
			import('@pie-players/pie-section-player-tools-pnp-debugger')
		]);
	});
	import { onDestroy, onMount, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import SourcePanel from './SourcePanel.svelte';

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

	let layoutType = $state<'vertical' | 'split-panel'>(getInitialLayoutType());
	let roleType = $state<'candidate' | 'scorer'>(getInitialMode());
	let toolbarPosition = $state<'top' | 'right' | 'bottom' | 'left'>('right');
	let layoutConfig = $state({ toolbarPosition: 'right' as 'top' | 'right' | 'bottom' | 'left' });
	let showSessionPanel = $state(false);
	let showSourcePanel = $state(false);
	let showPnpPanel = $state(false);
	let sectionPlayer: any = $state(null);
	let sessionDebuggerElement: any = $state(null);
	let pnpDebuggerElement: any = $state(null);

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
	let TOOL_STATE_STORAGE_KEY = $derived(`demo-tool-state:${data.demo.id}`);
	let TTS_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-tts-config-${data.demo.id}`);
	let LAYOUT_CONFIG_STORAGE_KEY = $derived(`pie-section-demo-layout-config-${data.demo.id}`);

	// Source panel state (read-only JSON view)
	let editedSourceJson = $state('');

	// Live section data (can be modified) - initialized in effect
	let liveSection: any = $state.raw({} as any);
	let previousDemoId = $state('');
	let resolvedSectionForPlayer = $derived.by(() => {
		if (!liveSection) return liveSection;
		const hasExplicitPnp = Boolean(
			liveSection?.personalNeedsProfile || liveSection?.settings?.personalNeedsProfile
		);
		if (hasExplicitPnp) return liveSection;
		return {
			...liveSection,
			personalNeedsProfile: createDefaultPersonalNeedsProfile()
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

			editedSourceJson = formatJsonForSourceView(data.section);

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
	let sessionPanelSectionId = $derived(liveSection?.identifier || data?.section?.identifier || 'section');

	// Set complex properties imperatively on the web component
	// (Web components can only receive simple values via attributes)
	$effect(() => {
		if (sectionPlayer && liveSection) {
			untrack(() => {
				sectionPlayer.section = resolvedSectionForPlayer;
				sectionPlayer.env = pieEnv;
				sectionPlayer.toolkitCoordinator = toolkitCoordinator;
				sectionPlayer.toolbarPosition = toolbarPosition;
			});
		}
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		untrack(() => {
			sessionDebuggerElement.toolkitCoordinator = toolkitCoordinator;
			sessionDebuggerElement.sectionId = sessionPanelSectionId;
		});
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		untrack(() => {
			pnpDebuggerElement.sectionData = liveSection;
			pnpDebuggerElement.roleType = roleType;
			pnpDebuggerElement.toolkitCoordinator = toolkitCoordinator;
		});
	});

	$effect(() => {
		if (!sessionDebuggerElement) return;
		const onClose = () => {
			showSessionPanel = false;
		};
		sessionDebuggerElement.addEventListener('close', onClose as EventListener);
		return () => {
			sessionDebuggerElement.removeEventListener('close', onClose as EventListener);
		};
	});

	$effect(() => {
		if (!pnpDebuggerElement) return;
		const onClose = () => {
			showPnpPanel = false;
		};
		pnpDebuggerElement.addEventListener('close', onClose as EventListener);
		return () => {
			pnpDebuggerElement.removeEventListener('close', onClose as EventListener);
		};
	});

	// Reset all sessions
	async function resetSessions() {
		const resolvedSectionId = liveSection?.identifier || data?.section?.identifier || 'section';
		try {
			await toolkitCoordinator?.disposeSectionController?.({
				sectionId: resolvedSectionId,
				clearPersistence: true,
				persistBeforeDispose: false
			});
		} catch (e) {
			console.warn('[Demo] Failed to clear section-controller persistence during reset:', e);
		}
		// Force page reload to reset player state
		if (browser) {
			window.location.reload();
		}
	}

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
				class="btn btn-sm btn-outline"
				onclick={() => void resetSessions()}
				title="Reset sessions and clear persisted section state"
				aria-label="Reset sessions"
			>
				Reset
			</button>
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
	<pie-section-player-tools-session-debugger bind:this={sessionDebuggerElement}>
	</pie-section-player-tools-session-debugger>
{/if}

<!-- Floating Source Window -->
{#if showSourcePanel}
	<SourcePanel editedSourceJson={editedSourceJson} onClose={() => showSourcePanel = false} />
{/if}

<!-- Floating PNP Profile Window -->
{#if showPnpPanel}
	<pie-section-player-tools-pnp-debugger bind:this={pnpDebuggerElement}>
	</pie-section-player-tools-pnp-debugger>
{/if}

