<!--
  pie-esm-player Custom Element

  An ESM-based custom element for scenarios where PIE element bundles are loaded
  dynamically from an ESM CDN (esm.sh, etc.). Uses import maps for version
  resolution and native browser module loading.

  Usage:
    <pie-esm-player
      config='{"elements":[],"models":[],"markup":"..."}'
      session='{"id":"session-123","data":[]}'
      env='{"mode":"gather","role":"student"}'
      addCorrectResponse="false"
      showBottomBorder="false"
      customClassname="my-class"
      containerClass="item-class"
      externalStyleUrls="https://example.com/styles.css"
      esmCdnUrl="https://esm.sh">
    </pie-esm-player>

  Events (matches pie-player):
    - session-changed: Fired when student interacts with PIE elements
    - load-complete: Fired when PIE elements are ready
    - player-error: Fired on errors
-->
<svelte:options
	customElement={{
    tag: 'pie-esm-player',
		shadow: 'none',
		props: {
			// Core props (match pie-player API)
			config: { attribute: 'config', type: 'Object' },
			session: { attribute: 'session', type: 'Object' },
			env: { attribute: 'env', type: 'Object' },

			// Behavioral props (match pie-player API)
			addCorrectResponse: { attribute: 'add-correct-response', type: 'Boolean' },
			showBottomBorder: { attribute: 'show-bottom-border', type: 'Boolean' },
			debug: { attribute: 'debug', type: 'String' },

			// Styling props (match pie-player API)
			customClassname: { attribute: 'custom-classname', type: 'String' },
			containerClass: { attribute: 'container-class', type: 'String' },
			externalStyleUrls: { attribute: 'external-style-urls', type: 'String' },

			// Tracking props (match pie-player API)
			loaderConfig: { attribute: 'loader-config', type: 'Object' },

			// ESM-specific props
			esmCdnUrl: { attribute: 'esm-cdn-url', type: 'String' },

			// Authoring mode props
			mode: { attribute: 'mode', type: 'String' },
			configuration: { attribute: 'configuration', type: 'Object' }
		}
  }}
/>

<script lang="ts">
	
	import type { ConfigEntity, Env, LoaderConfig } from '@pie-framework/pie-players-shared';
	import {
		BundleType,
		createPieLogger,
		DEFAULT_LOADER_CONFIG,
		EsmPieLoader,
		isGlobalDebugEnabled,
		makeUniqueTags,
	} from '@pie-framework/pie-players-shared';
	import PieItemPlayer from '@pie-framework/pie-players-shared/components/PieItemPlayer.svelte';
	import PieSpinner from '@pie-framework/pie-players-shared/components/PieSpinner.svelte';
import { tick } from 'svelte';

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
		debug = '' as string | boolean,

		// Styling props
		customClassname = '',
		containerClass = '',
		externalStyleUrls = '',

		// Tracking props (match pie-player API)
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,

		// ESM-specific props
		esmCdnUrl = 'https://esm.sh',

		// Authoring mode props
		mode = 'view' as 'view' | 'author',
		configuration = {} as Record<string, any>
	} = $props();

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
					console.log('[pie-esm-player] Setting PIE_DEBUG:', debugValue, 'from debug prop:', debug, 'type:', typeof debug);
				} catch {}
			}
			return debugValue;
		}
		const globalDebug = isGlobalDebugEnabled();
		if (isBrowser) {
			console.log('[pie-esm-player] Using global PIE_DEBUG:', globalDebug);
		}
		return globalDebug;
	});

	// Logger (pass function for dynamic debug checking on every call)
	const logger = createPieLogger('pie-esm-player', () => debugEnabled);

	// State
	let loading = $state(true);
	let error: string | null = $state(null);
	let itemConfig: ConfigEntity | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);

	// Generate unique class name for scoping external styles
	const fallbackScopeClass = `pie-player-${Date.now().toString(36)}`;
	const scopeClass = $derived((customClassname || fallbackScopeClass).trim());

	// Parse config and load ESM elements
	$effect(() => {
		if (config) {
			// Mark the start of processing for performance tracking
			performance.mark('pie-load-end');

			loading = true;
			error = null;

			(async () => {
				try {
					// Parse config if it's a string (from JSON.stringify)
					const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;

					// Validate config structure
					if (!parsedConfig.elements || !parsedConfig.models || !parsedConfig.markup) {
						const errorMsg = 'Invalid config: must contain elements, models, and markup';
						error = errorMsg;
						loading = false;

						// Track error with New Relic if enabled
						if (isBrowser && loaderConfig?.trackPageActions) {
							try {
								const newrelic = (window as any)?.newrelic;
								if (newrelic && typeof newrelic.noticeError === 'function') {
									newrelic.noticeError(new Error(errorMsg), {
										component: 'pie-esm-player',
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
					const transformed = makeUniqueTags({ config: parsedConfig });
					const transformedConfig = transformed.config;

					// Initialize ESM loader
					logger.debug('Creating ESM loader with CDN:', esmCdnUrl);
					const esmLoader = new EsmPieLoader({
						cdnBaseUrl: esmCdnUrl,
						debugEnabled: () => debugEnabled
					});

					// Load ESM elements into the global PIE registry
					logger.debug('Loading ESM elements');
					await esmLoader.load(transformedConfig, document, true); // Always load controllers for ESM

					// Wait for elements to be defined
					const elements = Object.keys(transformedConfig.elements).map(el => ({
						name: el,
						tag: el
					}));
					logger.debug('Waiting for elements:', elements);
					await esmLoader.elementsHaveLoaded(elements);
					logger.debug('✅ ESM elements loaded and ready');

					// Set item config - this will trigger PieItemPlayer to initialize
					itemConfig = transformedConfig;
					loading = false;
					error = null;

				} catch (err: any) {
					const errorMsg = `Error loading ESM elements: ${err.message}`;
					logger.error('ESM loading error:', err);
					error = errorMsg;
					loading = false;

					// Track error with New Relic if enabled
					if (isBrowser && loaderConfig?.trackPageActions) {
						try {
							const newrelic = (window as any)?.newrelic;
							if (newrelic && typeof newrelic.noticeError === 'function') {
								const itemIds = itemConfig?.models ? itemConfig.models.map((m: any) => m.id) : [];
								newrelic.noticeError(err, {
									component: 'pie-esm-player',
									errorType: 'EsmLoadingError',
									itemIds: itemIds.join(','),
									cdnBaseUrl: esmCdnUrl
								});
							}
						} catch (e) {
							logger.debug('New Relic tracking skipped (EsmLoadingError)');
						}
					}
				}
			})();
		} else {
			itemConfig = null;
			loading = true;
		}
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

			// Scope the styles by prepending .pie-esm-player.scopeClass to all selectors
			const scopedCss = cssText.replace(
				/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
				`.pie-esm-player.${scopeClass} $1$2`
			);

			// Inject scoped styles
			const style = document.createElement('style');
			style.setAttribute('data-pie-style', url); // Mark as loaded
			style.textContent = scopedCss;
			document.head.appendChild(style);

			logger.info(`✅ Loaded and scoped stylesheet: ${url}`);
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
			logger.warn('⚠️ Cannot dispatch event: custom element host not found');
		}
	};

	// Dispatch session-changed when session updates from PIE elements
	const handleSessionChanged = (event: CustomEvent) => {
		handlePlayerEvent(event);
	};
</script>

<div class="pie-esm-player {scopeClass}" bind:this={hostElement}>
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
		<!-- Use PieItemPlayer for rendering - shared with pie-fixed-player and pie-inline-player -->
		<div class="player-item-container {containerClass}">
			<PieItemPlayer
				{itemConfig}
				env={typeof env === 'string' ? JSON.parse(env) : env}
				session={(() => {
					const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
					return parsedSession.data || [];
				})()}
				{addCorrectResponse}
				customClassname={scopeClass}
				bundleType={mode === 'author' ? BundleType.editor : BundleType.clientPlayer}
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

	:global(.pie-esm-player) {
		width: 100%;
	}

	:global(.player-item-container) {
		width: 100%;
	}
</style>
