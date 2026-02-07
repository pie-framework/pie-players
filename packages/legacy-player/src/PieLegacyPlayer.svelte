<!--
  pie-legacy-player Custom Element

  A web component that loads and wraps the legacy @pie-framework/pie-player-components
  from jsdelivr CDN. This provides backwards compatibility with existing PIE deployments
  that use the pie-player custom element.

  Usage:
    <pie-legacy-player
      config='{"elements":[],"models":[],"markup":"..."}'
      session='{"id":"session-123","data":[]}'
      env='{"mode":"gather","role":"student"}'
      player-version="latest">
    </pie-legacy-player>

  Events:
    - session-changed: Fired when student interacts with PIE elements
    - load-complete: Fired when PIE elements are ready
    - player-error: Fired on errors
-->
<svelte:options
	customElement={{
    tag: 'pie-legacy-player',
		shadow: 'none',
		props: {
			// Core props (match pie-player API)
			config: { attribute: 'config', type: 'Object' },
			session: { attribute: 'session', type: 'Object' },
			env: { attribute: 'env', type: 'Object' },

			// Legacy player specific
			playerVersion: { attribute: 'player-version', type: 'String' }
		}
  }}
/>

<script lang="ts">
	import { onMount } from 'svelte';
	import { createPieLogger } from '@pie-players/pie-players-shared';

	type ItemSession = {
		id: string;
		data: Array<{
			id: string;        // Model ID (required)
			element: string;   // Element tag name (required)
			[key: string]: any;  // Other properties (value, shuffledValues, etc.)
		}>;
	};

	// Props (with Svelte 5 syntax)
	let {
		config = null as any,
		session = { id: '', data: [] } as ItemSession,
		env = { mode: 'gather', role: 'student'} as any,
		playerVersion = 'latest'
	} = $props();

	const logger = createPieLogger('pie-legacy-player', () => false);

	console.log('[PieLegacyPlayer] Component initializing');

	// State
	let loading = $state(true);
	let error: string | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);
	let playerElement: any = $state(null);
	let scriptLoaded = $state(false);

	// Load the legacy pie-player-components from jsdelivr
	onMount(async () => {
		const cdnUrl = `https://cdn.jsdelivr.net/npm/@pie-framework/pie-player-components@${playerVersion}/dist/pie-player-components/pie-player-components.esm.js`;

		try {
			// Check if already loaded
			const existingScript = document.querySelector(`script[src="${cdnUrl}"]`);
			if (existingScript) {
				logger.debug('Legacy player script already loaded');
				scriptLoaded = true;
				await customElements.whenDefined('pie-player');
				loading = false;
				return;
			}

			logger.debug('Loading legacy player from:', cdnUrl);

			// Load the script
			const script = document.createElement('script');
			script.type = 'module';
			script.src = cdnUrl;

			await new Promise<void>((resolve, reject) => {
				script.onload = () => {
					logger.debug('Legacy player script loaded');
					scriptLoaded = true;
					resolve();
				};
				script.onerror = () => {
					const errorMsg = `Failed to load legacy player from: ${cdnUrl}`;
					logger.error(errorMsg);
					error = errorMsg;
					reject(new Error(errorMsg));
				};
				document.head.appendChild(script);
			});

			// Wait for pie-player custom element to be defined
			await customElements.whenDefined('pie-player');
			logger.debug('pie-player custom element defined');

			loading = false;
		} catch (err: any) {
			const errorMsg = err?.message || String(err);
			logger.error('Error loading legacy player:', errorMsg);
			error = errorMsg;
			loading = false;
		}
	});

	// Set player properties imperatively when config/session/env changes
	$effect(() => {
		if (playerElement && config && scriptLoaded && !loading) {
			logger.debug('Setting player config');
			playerElement.config = config;
			playerElement.session = session;
			playerElement.env = env;
		}
	});

	// Attach event listeners imperatively
	$effect(() => {
		console.log('[PieLegacyPlayer] Effect running - playerElement:', !!playerElement, 'scriptLoaded:', scriptLoaded, 'loading:', loading);
		if (playerElement && scriptLoaded && !loading) {
			console.log('[PieLegacyPlayer] Attaching event listeners to playerElement:', playerElement);

			playerElement.addEventListener('session-changed', handleSessionChanged);
			playerElement.addEventListener('load-complete', handleLoadComplete);
			playerElement.addEventListener('player-error', handlePlayerError);

			return () => {
				console.log('[PieLegacyPlayer] Removing event listeners');
				playerElement.removeEventListener('session-changed', handleSessionChanged);
				playerElement.removeEventListener('load-complete', handleLoadComplete);
				playerElement.removeEventListener('player-error', handlePlayerError);
			};
		}
		return undefined;
	});

	// Forward events from pie-player
	const handleSessionChanged = (event: CustomEvent) => {
		console.log('[PieLegacyPlayer] Session changed event received:', event.detail);

		// Stop the original event from bubbling up - we'll dispatch our own enriched event
		event.stopPropagation();
		event.preventDefault();

		// Read the actual session data from the pie-player element's session property
		// The event.detail only contains { complete: boolean }, not the actual data
		const sessionData = playerElement?.session;
		console.log('[PieLegacyPlayer] Current session from element:', sessionData);

		const newEvent = new CustomEvent('session-changed', {
			detail: {
				...event.detail,
				session: sessionData
			},
			bubbles: true,
			composed: true
		});
		console.log('[PieLegacyPlayer] Dispatching new event with session data:', newEvent.detail);
		// Dispatch from the host element so it bubbles up properly
		hostElement?.dispatchEvent(newEvent);
	};

	const handleLoadComplete = (event: CustomEvent) => {
		logger.debug('[PieLegacyPlayer] Load complete:', event.detail);
		const newEvent = new CustomEvent('load-complete', {
			detail: event.detail,
			bubbles: true,
			composed: true
		});
		hostElement?.dispatchEvent(newEvent);
	};

	const handlePlayerError = (event: CustomEvent) => {
		logger.error('[PieLegacyPlayer] Player error:', event.detail);
		const newEvent = new CustomEvent('player-error', {
			detail: event.detail,
			bubbles: true,
			composed: true
		});
		hostElement?.dispatchEvent(newEvent);
	};
</script>

<div class="pie-legacy-player" bind:this={hostElement}>
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
			<h3 style="margin: 0 0 10px 0">⚠️ Legacy Player Error</h3>
			<p style="margin: 0">{error}</p>
		</div>
	{:else if loading}
		<div class="pie-player-loading" style="
			padding: 40px;
			text-align: center;
			font-family: sans-serif;
		">
			<div style="
				display: inline-block;
				width: 40px;
				height: 40px;
				border: 4px solid #f3f3f3;
				border-top: 4px solid #3498db;
				border-radius: 50%;
				animation: spin 1s linear infinite;
			"></div>
			<p style="margin-top: 10px; color: #666;">Loading PIE Player...</p>
		</div>
	{:else if scriptLoaded}
		<pie-player
			bind:this={playerElement}
		></pie-player>
	{/if}
</div>

<style>
	:host {
		display: block;
	}

	:global(.pie-legacy-player) {
		width: 100%;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>
