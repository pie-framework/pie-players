<!--
  pie-iife-player Custom Element

  A custom element for dynamically loading PIE element bundles from the PIE build service.
  Uses IIFE (Immediately Invoked Function Expression) bundles, similar to the original
  @pie-framework/pie-player-components.

  Usage:
    <pie-iife-player
      config='{"elements":[],"models":[],"markup":"..."}'
      session='{"id":"session-123","data":[]}'
      env='{"mode":"gather","role":"student"}'
      addCorrectResponse="false"
      showBottomBorder="false"
      bundleHost="https://proxy.pie-api.com/bundles/"
      customClassname="my-class"
      containerClass="item-class"
      externalStyleUrls="https://example.com/styles.css">
    </pie-iife-player>

  Events (matches pie-player):
    - session-changed: Fired when student interacts with PIE elements
    - load-complete: Fired when PIE elements are ready
    - player-error: Fired on errors
-->
<svelte:options
	customElement={{
    tag: 'pie-iife-player',
		shadow: 'none',
		props: {
			// Core props (match pie-player API)
			config: { attribute: 'config', type: 'Object' },
			session: { attribute: 'session', type: 'Object' },
			env: { attribute: 'env', type: 'Object' },

			// Behavioral props (match pie-player API)
			addCorrectResponse: { attribute: 'add-correct-response', type: 'Boolean' },
			showBottomBorder: { attribute: 'show-bottom-border', type: 'Boolean' },
			hosted: { attribute: 'hosted', type: 'Boolean' },
			debug: { attribute: 'debug', type: 'String' },

			// Styling props (match pie-player API)
			customClassname: { attribute: 'custom-classname', type: 'String' },
			containerClass: { attribute: 'container-class', type: 'String' },
			externalStyleUrls: { attribute: 'external-style-urls', type: 'String' },

			// Tracking props (match pie-player API)
			loaderConfig: { attribute: 'loader-config', type: 'Object' },

			// IIFE-specific props
			bundleHost: { attribute: 'bundle-host', type: 'String' },

			// Authoring mode props
			mode: { attribute: 'mode', type: 'String' },
			configuration: { attribute: 'configuration', type: 'Object' }
		}
  }}
/>

<script lang="ts">
	
	import type { ConfigEntity, Env, LoaderConfig } from '@pie-framework/pie-players-shared';
	import { BundleType, createPieLogger, DEFAULT_BUNDLE_HOST, DEFAULT_LOADER_CONFIG, IifePieLoader, isGlobalDebugEnabled, makeUniqueTags } from '@pie-framework/pie-players-shared';
	import PieItemPlayer from '@pie-framework/pie-players-shared/components/PieItemPlayer.svelte';
	import PieSpinner from '@pie-framework/pie-players-shared/components/PieSpinner.svelte';
	import { tick, untrack } from 'svelte';
	// Import global component styles 
	import './components.css';

	type ItemSession = {
		id: string;
		data: Array<{
			id: string;        // Model ID (required)
			element: string;   // Element tag name (required)
			[key: string]: any;  // Other properties (value, shuffledValues, etc.)
		}>;
	};

	// Props (with Svelte 5 syntax) - match pie-player API
	let {
		// Core props - REQUIRED
		config = null as any,
		session = { id: '', data: [] } as ItemSession,
		env = { mode: 'gather', role: 'student'} as Env,

		// Behavioral props
		addCorrectResponse = false,
		showBottomBorder = false,
		hosted = false,
		debug = '' as string | boolean,

		// Styling props
		customClassname = '',
		containerClass = '',
		externalStyleUrls = '',

		// Tracking props (match pie-player API)
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,

		// IIFE-specific props
		bundleHost = DEFAULT_BUNDLE_HOST,

		// Authoring mode props
		mode = 'view' as 'view' | 'author',
		configuration = {} as Record<string, any>
	} = $props();

	// Parse addCorrectResponse (handle string "true"/"false" from HTML attribute)
	const addCorrectResponseBool = $derived.by(() => {
		if (typeof addCorrectResponse === 'string') {
			return addCorrectResponse === 'true';
		}
		return Boolean(addCorrectResponse);
	});

	// Browser detection (SSR safety)
	const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

	// Determine debug state
	const debugEnabled = $derived.by(() => {
		if (debug !== undefined && debug !== null) {
			const debugStr = String(debug);
			const debugValue = (!(debugStr.toLowerCase() === 'false' || debugStr === '0' || debugStr === ''));

			if (isBrowser) {
				try {
					(window as any).PIE_DEBUG = debugValue;
					// IMPORTANT: Don't use `logger` here.
					// `logger.debug(...)` reads `debugEnabled`, and this derived computes `debugEnabled`,
					// which would create a reactivity cycle and can stack overflow.
				} catch {}
			}
			return debugValue;
		}
		const globalDebug = isGlobalDebugEnabled();
		return globalDebug;
	});

	// Logger (pass function for dynamic debug checking on every call)
	const logger = createPieLogger('pie-iife-player', () => debugEnabled);

	// State
	let loading = $state(true);
	let error: string | null = $state(null);
	let itemConfig: ConfigEntity | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);

	// Generate a stable class name for scoping external styles
	function stableHashBase36(input: string) {
		let h = 5381;
		for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
		return (h >>> 0).toString(36);
	}

	const fallbackScopeClass = $derived.by(() => {
		if (customClassname) return customClassname;
		const hash = stableHashBase36('/packages/pie-iife-player/src/PieIifePlayer.svelte').slice(0, 9);
		return `pie-player-${hash}`;
	});

	const scopeClass = $derived(customClassname || fallbackScopeClass);

	// Parse config and load IIFE elements
	let lastProcessedConfig: any = null;
	let lastProcessedMode: any = null;
	let lastProcessedHosted: any = null;
	let lastProcessedBundleHost: any = null;
	let isProcessing = false;

	// Use a function instead of $effect to avoid reactivity loops
	async function loadConfig(currentConfig: any) {
		// Prevent re-runs if already processing or config hasn't changed
		// IMPORTANT: author/preview mode changes require a different bundle (editor.js vs client-player.js),
		// so we must treat mode/hosted/bundleHost as part of the "load key".
		if (
			isProcessing ||
			(currentConfig === lastProcessedConfig &&
				mode === lastProcessedMode &&
				hosted === lastProcessedHosted &&
				bundleHost === lastProcessedBundleHost)
		) {
			return;
		}

		if (!currentConfig) {
			itemConfig = null;
			loading = true;
			return;
		}

		isProcessing = true;
		lastProcessedConfig = currentConfig;
		lastProcessedMode = mode;
		lastProcessedHosted = hosted;
		lastProcessedBundleHost = bundleHost;

		// Mark the start of processing for performance tracking
		performance.mark('pie-load-end');

		loading = true;
		error = null;

		let stage = 'start';
		try {
			// Parse config if it's a string (from JSON.stringify)
			stage = 'parse-config';
			const parsedConfig = typeof currentConfig === 'string' ? JSON.parse(currentConfig) : currentConfig;

			// Validate config structure
			stage = 'validate-config';
			if (!parsedConfig.elements || !parsedConfig.models || !parsedConfig.markup) {
				const errorMsg = 'Invalid config: must contain elements, models, and markup';
				error = errorMsg;
				loading = false;
				isProcessing = false;

				// Track error with New Relic if enabled
				if (isBrowser && loaderConfig?.trackPageActions) {
					try {
						const newrelic = (window as any)?.newrelic;
						if (newrelic && typeof newrelic.noticeError === 'function') {
							newrelic.noticeError(new Error(errorMsg), {
								component: 'pie-iife-player',
								errorType: 'InvalidConfig'
							});
						}
					} catch (e) {
						logger.debug('New Relic tracking skipped (InvalidConfig)');
					}
				}
				return;
			}

			// Apply makeUniqueTags to ensure valid custom element names
			stage = 'makeUniqueTags';
			const transformed = makeUniqueTags({ config: parsedConfig });
			const transformedConfig = transformed.config;

			// Initialize IIFE loader
			stage = 'create-iife-loader';
			logger.debug('Creating IIFE loader with bundle host:', bundleHost);
			const iifeLoader = new IifePieLoader({
				bundleHost: bundleHost,
				debugEnabled: () => debugEnabled
			});

			// Determine bundle type based on mode and hosted flag
			stage = 'determine-bundleType';
			const bundleType = mode === 'author'
				? BundleType.editor
				: (hosted ? BundleType.player : BundleType.clientPlayer);
			// Authoring bundles (editor.js) should not require controllers.
			const needsControllers = bundleType !== BundleType.editor && !hosted;

			// Load IIFE elements into the global PIE registry
			stage = 'iifeLoader.load';
			logger.debug('Loading IIFE elements, bundle type:', bundleType);
			logger.debug('Bundle type determination: mode=%s, hosted=%s, needsControllers=%s', mode, hosted, needsControllers);
			await iifeLoader.load(
				transformedConfig,
				document,
				bundleType,
				needsControllers
			);

			// Wait for elements to be defined
			stage = 'elementsHaveLoaded';
			const isEditorBundle = bundleType === BundleType.editor;
			const elements = Object.keys(transformedConfig.elements).map((el) => ({
				name: el,
				// Editor bundles register configure elements with `-config` suffix
				tag: isEditorBundle ? `${el}-config` : el,
			}));
			logger.debug('Waiting for elements:', elements);
			await iifeLoader.elementsHaveLoaded(elements);
			logger.debug('IIFE elements loaded and ready');

			// Set item config - this will trigger PieItemPlayer to initialize
			stage = 'set-itemConfig';
			itemConfig = transformedConfig;
			loading = false;
			error = null;
			isProcessing = false;

		} catch (err: any) {
			const message = err?.message || String(err);
			const errorMsg = `Error loading IIFE elements (${stage}): ${message}`;
			// Avoid logging potentially huge/cyclic objects by logging message + stack string.
			logger.error('IIFE loading error:', message, err?.stack);
			error = errorMsg;
			loading = false;
			isProcessing = false;

			// Track error with New Relic if enabled
			if (isBrowser && loaderConfig?.trackPageActions) {
				try {
					const newrelic = (window as any)?.newrelic;
					if (newrelic && typeof newrelic.noticeError === 'function') {
						const itemIds = itemConfig?.models ? itemConfig.models.map((m: any) => m.id) : [];
						newrelic.noticeError(err, {
							component: 'pie-iife-player',
							errorType: 'IifeLoadingError',
							itemIds: itemIds.join(','),
							bundleHost: bundleHost
						});
					}
				} catch (e) {
					logger.debug('New Relic tracking skipped (IifeLoadingError)');
				}
			}
		}
	}

	// Watch config changes and call loadConfig
	$effect(() => {
		const currentConfig = config;
		// Ensure we also reload when the desired bundle changes (author vs preview, hosted, or host URL)
		// even if the `config` object reference stays the same.
		// These reads are intentional to make them reactive dependencies of this effect.
		const _mode = mode;
		const _hosted = hosted;
		const _bundleHost = bundleHost;
		// Use queueMicrotask to break out of the reactive context
		queueMicrotask(() => {
			untrack(() => {
				loadConfig(currentConfig);
			});
		});
	});

	// Helper to load and scope external stylesheet (matches pie-player behavior)
	const loadScopedExternalStyle = async (url: string) => {
		if (!isBrowser || !url || typeof url !== 'string') return;

		// Check if already loaded (prevent duplicates)
		if (document.querySelector(`style[data-pie-style="${url}"]`)) {
			logger.debug(`Stylesheet already loaded: ${url}`);
			return;
		}

		try {
			const response = await fetch(url);
			const cssText = await response.text();

			// Scope the styles by prepending .pie-iife-player.scopeClass to all selectors
			const scopedCss = cssText.replace(
				/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
				`.pie-iife-player.${scopeClass} $1$2`
			);

			// Inject scoped styles
			const style = document.createElement('style');
			style.setAttribute('data-pie-style', url); // Mark as loaded
			style.textContent = scopedCss;
			document.head.appendChild(style);

			logger.info(`Loaded and scoped stylesheet: ${url}`);
		} catch (err) {
			logger.error(`❌ Failed to load external stylesheet: ${url}`, err);
		}
	};

	// Load external stylesheets from externalStyleUrls prop (matches pie-player behavior)
	$effect(() => {
		if (externalStyleUrls && typeof externalStyleUrls === 'string') {
			const urls = externalStyleUrls.split(',').map(url => url.trim());

			urls.forEach(url => {
				if (url) {
					loadScopedExternalStyle(url);
				}
			});
		}
	});

	// Load external stylesheets from config.resources.stylesheets (matches pie-player behavior)
	$effect(() => {
		if (isProcessing) return; // Don't run during initial load
		if (!itemConfig?.resources?.stylesheets) return;

		const stylesheets = itemConfig.resources.stylesheets;
		if (Array.isArray(stylesheets)) {
			stylesheets.forEach(resource => {
				const url = resource?.url;
				if (url && typeof url === 'string') {
					loadScopedExternalStyle(url);
				}
			});
		}
	});

	// Add bottom border in evaluate mode if requested (matches pie-player behavior)
	$effect(() => {
		if (isProcessing) return; // Don't run during initial load
		const cfg = itemConfig;
		if (showBottomBorder && env.mode === 'evaluate' && cfg?.elements) {
			tick().then(() => {
				const elementTags = Object.keys(cfg.elements);
				elementTags.forEach(tag => {
					const elements = document.querySelectorAll(tag);
					elements.forEach((el) => {
						if (el instanceof HTMLElement) {
							el.style.borderBottom = '1px solid #ddd';
							el.style.paddingBottom = '20px';
							el.style.marginBottom = '20px';
						}
					});
				});
			});
		}
	});

	// Forward events from PieItemPlayer (matches pie-player events)
	const handlePlayerEvent = (event: CustomEvent) => {
		// Re-dispatch with same name (session-changed, load-complete, player-error)
		const newEvent = new CustomEvent(event.type, {
			detail: event.detail,
			bubbles: true,
			composed: true
		});

		// Dispatch from the custom element host (not the inner div)
		if (hostElement?.parentElement) {
			hostElement.parentElement.dispatchEvent(newEvent);
			logger.debug(`Dispatched ${event.type} event from custom element host`);
		} else {
			logger.warn('Cannot dispatch event: custom element host not found');
		}
	};

	// Dispatch session-changed when session updates from PIE elements
	const handleSessionChanged = (event: CustomEvent) => {
		handlePlayerEvent(event);
	};
</script>

<div class="pie-iife-player {scopeClass}" bind:this={hostElement}>
	{#if error}
		<div class="pie-player-error" style="
			padding: 20px;
			margin: 20px;
			border: 2px solid #d32f2f;
			border-radius: 4px;
			background-color: #ffebee;
			color: #c62828;
			font-family: sans-serif;
		">
			<h3 style="margin: 0 0 10px 0">⚠️ Configuration Error</h3>
			<p style="margin: 0">{error}</p>
		</div>
	{:else if loading || !itemConfig}
		<PieSpinner />
	{:else}
		<!-- Use PieItemPlayer for rendering - shared with all other players -->
		<div class="player-item-container {containerClass}">
			<PieItemPlayer
				{itemConfig}
				env={typeof env === 'string' ? JSON.parse(env) : env}
				session={(() => {
					const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
					return parsedSession.data || [];
				})()}
				addCorrectResponse={addCorrectResponseBool}
				customClassname={scopeClass}
				bundleType={mode === 'author' ? BundleType.editor : (hosted ? BundleType.player : BundleType.clientPlayer)}
				{loaderConfig}
				{mode}
				configuration={typeof configuration === 'string' ? JSON.parse(configuration) : configuration}
				onLoadComplete={(detail) => handlePlayerEvent(new CustomEvent('load-complete', { detail }))}
				onPlayerError={(detail) => handlePlayerEvent(new CustomEvent('player-error', { detail }))}
				onSessionChanged={(detail) => handleSessionChanged(new CustomEvent('session-changed', { detail }))}
				onModelUpdated={(detail) => handlePlayerEvent(new CustomEvent('model-updated', { detail }))}
			/>
		</div>
	{/if}
</div>

<style>
	:host {
		display: block;
	}

	:global(.pie-iife-player) {
		width: 100%;
	}

	:global(.player-item-container) {
		width: 100%;
	}
</style>
