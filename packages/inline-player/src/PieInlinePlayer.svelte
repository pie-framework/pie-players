<!--
  pie-inline-player Custom Element
  
  A testing/development custom element that matches the pie-player API exactly.
  Uses dynamically loaded bundles (blob URLs) for isolated testing without client dependencies.
  
  Usage (matches pie-player interface):
    <pie-inline-player
      config='{"elements":[],"models":[],"markup":"..."}'
      session='{"id":"session-123","data":[]}'
      env='{"mode":"gather","role":"student"}'
      hosted="true"
      addCorrectResponse="false"
      renderStimulus="true"
      allowedResize="false"
      showBottomBorder="false"
      customClassname="my-class"
      containerClass="item-class"
      passageContainerClass="passage-class">
    </pie-inline-player>
    
  Events (matches pie-player):
    - session-changed: Fired when student interacts with PIE elements
    - load-complete: Fired when PIE elements are ready
    - player-error: Fired on errors
-->
<svelte:options
	customElement={{
		tag: 'pie-inline-player',
		shadow: 'none',
		props: {
			// Core props (match pie-player API)
			config: { attribute: 'config', type: 'Object' },
			session: { attribute: 'session', type: 'Object' },
			env: { attribute: 'env', type: 'Object' },
			
			// Behavioral props (match pie-player API)
			addCorrectResponse: { attribute: 'add-correct-response', type: 'Boolean' },
			renderStimulus: { attribute: 'render-stimulus', type: 'Boolean' },
			allowedResize: { attribute: 'allowed-resize', type: 'Boolean' },
			showBottomBorder: { attribute: 'show-bottom-border', type: 'Boolean' },
			debug: { attribute: 'debug', type: 'Boolean' },
			
			// Styling props (match pie-player API)
			customClassname: { attribute: 'custom-classname', type: 'String' },
			containerClass: { attribute: 'container-class', type: 'String' },
			passageContainerClass: { attribute: 'passage-container-class', type: 'String' },
			externalStyleUrls: { attribute: 'external-style-urls', type: 'String' },
			
			// Bundle type (for controller validation)
			bundleType: { attribute: 'bundle-type', type: 'String' },
			
			// Tracking props (match pie-player API)
			loaderConfig: { attribute: 'loader-config', type: 'Object' }
		}
	}}
/>

<script lang="ts">
	
	import type { ConfigEntity, Env, LoaderConfig } from '@pie-framework/pie-players-shared';
	import { BundleType, createPieLogger, DEFAULT_LOADER_CONFIG, isGlobalDebugEnabled, makeUniqueTags } from '@pie-framework/pie-players-shared';
	import PieItemPlayer from '@pie-framework/pie-players-shared/components/PieItemPlayer.svelte';
	import PieSpinner from '@pie-framework/pie-players-shared/components/PieSpinner.svelte';
import { tick } from 'svelte';

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
		renderStimulus = true,
		allowedResize = false,
		showBottomBorder = false,
		debug = false,
		
		// Styling props
		customClassname = '',
		containerClass = '',
		passageContainerClass = '',
		externalStyleUrls = '',
		
		// Bundle type (for controller validation)
		bundleType = 'player.js' as string,
		
		// Tracking props (match pie-player API)
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig
	} = $props();

	// Parse debug prop (handle both boolean and string "true"/"false")
	const debugEnabled = $derived.by(() => {
		// Handle string "true"/"false" from HTML attributes
		if (typeof debug === 'string') {
			return debug === 'true';
		}
		return debug || isGlobalDebugEnabled();
	});

	// Logger (pass function for dynamic debug checking on every call)
	const logger = createPieLogger('pie-inline-player', () => debugEnabled);

	// State
	let loading = $state(true);
	let error: string | null = $state(null);
	let itemConfig: ConfigEntity | null = $state(null);
	let passageConfig: ConfigEntity | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);
	
	// Stimulus layout resizing (parity with pie-player's pie-stimulus-layout)
	const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
	let splitPct = $state(50); // percentage width for passage side
	let isResizing = $state(false);
	let stimulusContainerEl: HTMLElement | null = $state(null);
	
	const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
	
	const startResize = (e: MouseEvent | TouchEvent) => {
		if (!allowedResize) return;
		isResizing = true;
		e.preventDefault();
		e.stopPropagation();
	};
	
	const getClientX = (e: MouseEvent | TouchEvent): number => {
		if ('touches' in e) {
			return e.touches[0]?.clientX ?? 0;
		}
		return e.clientX ?? 0;
	};
	
	$effect(() => {
		if (!isBrowser || !isResizing) return;
		
		const onMove = (e: MouseEvent | TouchEvent) => {
			if (!stimulusContainerEl) return;
			const rect = stimulusContainerEl.getBoundingClientRect();
			const x = getClientX(e);
			const pct = ((x - rect.left) / rect.width) * 100;
			// Keep panels usable
			splitPct = clamp(pct, 20, 80);
		};
		
		const onUp = () => {
			isResizing = false;
		};
		
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		window.addEventListener('touchmove', onMove, { passive: false });
		window.addEventListener('touchend', onUp);
		
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchmove', onMove);
			window.removeEventListener('touchend', onUp);
		};
	});
	
	// Resolve container classes from config.resources (parity with pie-player)
	const resolvedContainerClass = $derived.by(() => {
		const fromConfig = (itemConfig as any)?.resources?.containerClass;
		return (fromConfig || containerClass || '').trim();
	});
	
	const resolvedPassageContainerClass = $derived.by(() => {
		const fromConfig = (itemConfig as any)?.resources?.passageContainerClass;
		return (fromConfig || passageContainerClass || '').trim();
	});
	
	// Generate unique class name for scoping external styles
	const fallbackScopeClass = `pie-player-${Math.random().toString(36).slice(2, 11)}`;
	const scopeClass = $derived((customClassname || fallbackScopeClass).trim());
	
	// Helper to load and scope external stylesheet (matches pie-player behavior)
	const loadScopedExternalStyle = async (url: string) => {
		if (!url || typeof url !== 'string') return;
		
		// Check if already loaded (prevent duplicates)
		if (document.querySelector(`style[data-pie-style="${url}"]`)) {
			logger.debug(`Stylesheet already loaded: ${url}`);
			return;
		}
		
		try {
			const response = await fetch(url);
			const cssText = await response.text();
			
			// Scope the styles by prepending .pie-inline-player.scopeClass to all selectors
			const scopedCss = cssText.replace(
				/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
				`.pie-inline-player.${scopeClass} $1$2`
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
	
	// Parse config into item/passage configs (handle both simple and stimulus formats)
	$effect(() => {
		if (config) {
			// Mark the start of processing for performance tracking (matches pie-player)
			performance.mark('pie-load-end');
			
			logger.debug('Received config:', {
				configType: typeof config,
				isString: typeof config === 'string',
				hasPie: !!(config?.pie),
				hasPassage: !!(config?.passage),
				hasElements: !!(config?.elements),
				hasModels: !!(config?.models),
				hasMarkup: !!(config?.markup),
				configKeys: typeof config === 'object' ? Object.keys(config) : 'N/A',
				configPreview: JSON.stringify(config).substring(0, 200)
			});
			
			try {
				// Parse config if it's a string (from JSON.stringify)
				const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
				logger.debug('Parsed config:', {
					hasPie: !!(parsedConfig?.pie),
					hasPassage: !!(parsedConfig?.passage),
					hasElements: !!(parsedConfig?.elements),
					hasModels: !!(parsedConfig?.models),
					hasMarkup: !!(parsedConfig?.markup)
				});
				
				// Check if parsedConfig has stimulus structure (passage + pie)
				if (parsedConfig.pie && parsedConfig.passage) {
					// Stimulus item - apply makeUniqueTags to ensure valid custom element names
					const transformedPie = makeUniqueTags({ config: parsedConfig.pie });
					const transformedPassage = makeUniqueTags({ config: parsedConfig.passage });
					itemConfig = transformedPie.config;
					passageConfig = renderStimulus ? transformedPassage.config : null;
					loading = false;
					error = null;
				} else if (parsedConfig.elements || parsedConfig.models || parsedConfig.markup) {
					// Simple item - apply makeUniqueTags to ensure valid custom element names
					const transformed = makeUniqueTags({ config: parsedConfig });
					itemConfig = transformed.config;
					passageConfig = null;
					loading = false;
					error = null;
				} else {
					const errorMsg = 'Invalid config: must contain elements, models, and markup, or pie/passage structure';
					error = errorMsg;
					loading = false;
					
					// Track error with New Relic if enabled (matches pie-player)
					if (loaderConfig?.trackPageActions && (window as any).newrelic) {
						(window as any).newrelic.noticeError(new Error(errorMsg), {
							component: 'pie-inline-player',
							errorType: 'InvalidConfig'
						});
					}
				}
			} catch (e: any) {
				const errorMsg = `Error parsing config: ${e.message}`;
				error = errorMsg;
				loading = false;
				
				// Track error with New Relic if enabled (matches pie-player)
				if (loaderConfig?.trackPageActions && (window as any).newrelic) {
					(window as any).newrelic.noticeError(e, {
						component: 'pie-inline-player',
						errorType: 'ConfigParseError'
					});
				}
			}
		} else {
			itemConfig = null;
			passageConfig = null;
			loading = true;
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
		// Since shadow: 'none', the div's parentElement is the custom element
		if (hostElement?.parentElement) {
			hostElement.parentElement.dispatchEvent(newEvent);
			logger.debug(`Dispatched ${event.type} event from custom element host`);
		} else {
			logger.warn('⚠️ Cannot dispatch event: custom element host not found');
		}
	};
	
	// Dispatch session-changed when session updates from PIE elements
	const handleSessionChanged = (event: CustomEvent) => {
		// This is the critical event for Quiz Engine integration
		handlePlayerEvent(event);
	};
</script>

<div class="pie-inline-player {scopeClass}" bind:this={hostElement}>
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
		{#if passageConfig && renderStimulus}
			<!-- Stimulus item with passage: two-panel layout (parity with pie-player) -->
			<div
				class="pie-stimulus-container"
				bind:this={stimulusContainerEl}
				style="display: flex; width: 100%; {isResizing ? 'user-select: none;' : ''}"
			>
				<div
					class="player-stimulus-container {resolvedPassageContainerClass}"
					style="flex: 0 0 {splitPct}%; min-width: 0;"
				>
					<!-- Parity with pie-player: never apply addCorrectResponse to the passage side -->
					<PieItemPlayer
						itemConfig={passageConfig}
						env={typeof env === 'string' ? JSON.parse(env) : env}
						session={(() => {
							const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
							return parsedSession.data || [];
						})()}
						addCorrectResponse={false}
						customClassname={scopeClass}
						containerClass={resolvedPassageContainerClass}
						bundleType={bundleType === 'client-player.js' ? BundleType.clientPlayer : BundleType.player}
						{loaderConfig}
						onLoadComplete={(detail) => handlePlayerEvent(new CustomEvent('load-complete', { detail }))}
						onPlayerError={(detail) => handlePlayerEvent(new CustomEvent('player-error', { detail }))}
						onSessionChanged={(detail) => handleSessionChanged(new CustomEvent('session-changed', { detail }))}
					/>
				</div>
				
				{#if allowedResize}
					<div
						class="pie-stimulus-resizer"
						role="separator"
						aria-orientation="vertical"
						tabindex="0"
						onmousedown={startResize}
						ontouchstart={startResize}
						style="flex: 0 0 10px; cursor: col-resize; display: flex; align-items: center; justify-content: center;"
					>
						<div style="width: 2px; height: 60px; background: rgba(0,0,0,0.2); border-radius: 2px;"></div>
					</div>
				{:else}
					<div style="flex: 0 0 20px;"></div>
				{/if}
				
				<div
					class="player-item-container {resolvedContainerClass}"
					style="flex: 1 1 calc({100 - splitPct}%); min-width: 0;"
				>
					<PieItemPlayer
						{itemConfig}
						env={typeof env === 'string' ? JSON.parse(env) : env}
						session={(() => {
							const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
							return parsedSession.data || [];
						})()}
						{addCorrectResponse}
						customClassname={scopeClass}
						containerClass={resolvedContainerClass}
						bundleType={bundleType === 'client-player.js' ? BundleType.clientPlayer : BundleType.player}
						{loaderConfig}
						onLoadComplete={(detail) => handlePlayerEvent(new CustomEvent('load-complete', { detail }))}
						onPlayerError={(detail) => handlePlayerEvent(new CustomEvent('player-error', { detail }))}
						onSessionChanged={(detail) => handleSessionChanged(new CustomEvent('session-changed', { detail }))}
					/>
				</div>
			</div>
		{:else}
			<!-- Simple item or stimulus without passage rendering -->
			<PieItemPlayer
				{itemConfig}
				{passageConfig}
				env={typeof env === 'string' ? JSON.parse(env) : env}
				session={(() => {
					const parsedSession = typeof session === 'string' ? JSON.parse(session) : session;
					return parsedSession.data || [];
				})()}
				{addCorrectResponse}
				customClassname={scopeClass}
				passageContainerClass={resolvedPassageContainerClass}
				containerClass={resolvedContainerClass}
				bundleType={bundleType === 'client-player.js' ? BundleType.clientPlayer : BundleType.player}
				{loaderConfig}
				onLoadComplete={(detail) => handlePlayerEvent(new CustomEvent('load-complete', { detail }))}
				onPlayerError={(detail) => handlePlayerEvent(new CustomEvent('player-error', { detail }))}
				onSessionChanged={(detail) => handleSessionChanged(new CustomEvent('session-changed', { detail }))}
			/>
		{/if}
	{/if}
</div>

<style>
	:host {
		display: block;
	}
	
	:global(.pie-inline-player) {
		width: 100%;
	}
	
	:global(.player-item-container),
	:global(.player-stimulus-container) {
		width: 100%;
	}
</style>
