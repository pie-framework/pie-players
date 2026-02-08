<!--
  TTS Settings Component

  Provides UI for switching between TTS providers and configuring provider-specific settings.
  Supports both standard W3C parameters and provider-specific extensions.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	interface Voice {
		id: string;
		name: string;
		language: string;
		languageCode: string;
		gender?: 'male' | 'female' | 'neutral';
		quality: 'standard' | 'premium' | 'neural';
	}

	interface TTSConfig {
		// Standard W3C parameters
		provider: 'polly' | 'browser';
		voice: string;
		rate: number;
		pitch: number;

		// Provider-specific extensions
		pollyEngine?: 'neural' | 'standard';
		pollySampleRate?: number;
	}

	let {
		config = $bindable<TTSConfig>({
			provider: 'polly',
			voice: 'Joanna',
			rate: 1.0,
			pitch: 1.0,
			pollyEngine: 'neural',
			pollySampleRate: 24000,
		}),
		onConfigChange,
		ttsService = null
	}: {
		config?: TTSConfig;
		onConfigChange?: (config: TTSConfig) => void;
		ttsService?: any;
	} = $props();

	// Voice discovery state
	let availableVoices = $state<Voice[]>([]);
	let loadingVoices = $state(false);
	let voicesError = $state<string | null>(null);

	// Browser voices (Web Speech API)
	let browserVoices = $state<SpeechSynthesisVoice[]>([]);

	// Trigger config change callback
	function handleConfigChange() {
		if (onConfigChange) {
			onConfigChange(config);
		}
	}

	// Load browser voices
	function loadBrowserVoices() {
		if (browser && 'speechSynthesis' in window) {
			browserVoices = speechSynthesis.getVoices();

			// Chrome loads voices asynchronously
			if (browserVoices.length === 0) {
				speechSynthesis.addEventListener('voiceschanged', () => {
					browserVoices = speechSynthesis.getVoices();
				});
			}
		}
	}

	// Fetch Polly voices from API
	async function loadPollyVoices() {
		// Prevent concurrent loading
		if (loadingVoices) {
			console.log('[TTSSettings] Already loading voices, skipping...');
			return;
		}

		loadingVoices = true;
		voicesError = null;

		try {
			const response = await fetch('/api/tts/voices?provider=polly');
			if (!response.ok) {
				throw new Error(`Failed to fetch voices: ${response.statusText}`);
			}

			const data = await response.json();
			availableVoices = data.voices || [];
		} catch (error) {
			voicesError = error instanceof Error ? error.message : 'Failed to load voices';
			console.error('[TTSSettings] Failed to load Polly voices:', error);
		} finally {
			loadingVoices = false;
		}
	}

	// Track which provider we've loaded voices for
	let voicesLoadedFor: 'polly' | 'browser' | null = $state(null);

	// Load voices when provider changes
	$effect(() => {
		const provider = config.provider;

		// Only load if we haven't already loaded for this provider
		if (provider !== voicesLoadedFor) {
			voicesLoadedFor = provider;

			if (provider === 'polly') {
				loadPollyVoices();
			} else {
				loadBrowserVoices();
			}
		}
	});

	// Available voices for current provider
	let currentProviderVoices = $derived.by(() => {
		if (config.provider === 'browser') {
			return browserVoices.map(v => ({
				id: v.name,
				name: v.name,
				language: v.lang,
				languageCode: v.lang,
				gender: undefined,
				quality: 'standard' as const,
			}));
		}
		return availableVoices;
	});

	// Filter voices by engine for Polly
	let filteredVoices = $derived.by(() => {
		if (config.provider === 'polly' && config.pollyEngine) {
			return currentProviderVoices.filter(v => v.quality === config.pollyEngine);
		}
		return currentProviderVoices;
	});

	// Voice preview state
	let isPreviewing = $state(false);

	// Preview voice with sample text
	// Uses updateSettings() to temporarily apply current UI settings without page reload
	async function previewVoice() {
		if (!ttsService || isPreviewing) return;

		isPreviewing = true;
		try {
			// Stop any current playback
			ttsService.stop();

			// Temporarily apply current UI settings for preview
			await ttsService.updateSettings({
				rate: config.rate,
				pitch: config.pitch,
				voice: config.voice
			});

			// Speak preview text with updated settings
			const sampleText = 'This is a preview of the selected voice with current settings.';
			await ttsService.speak(sampleText);
		} catch (error) {
			console.error('[TTSSettings] Failed to preview voice:', error);
		} finally {
			// Add a small delay to prevent rapid clicking
			setTimeout(() => {
				isPreviewing = false;
			}, 500);
		}
	}
</script>

<div class="tts-settings space-y-4">
	<!-- Provider Selection -->
	<div class="form-control">
		<div class="label">
			<span class="label-text font-semibold">TTS Provider</span>
			<span class="label-text-alt text-xs">
				{#if config.provider === 'polly'}
					<span class="badge badge-xs badge-success">Standard + Extensions</span>
				{:else}
					<span class="badge badge-xs badge-info">W3C Standard Only</span>
				{/if}
			</span>
		</div>
		<div class="join w-full" role="group" aria-label="TTS Provider Selection">
			<button
				class="btn btn-sm join-item flex-1"
				class:btn-active={config.provider === 'polly'}
				onclick={() => {
					config.provider = 'polly';
					config.voice = 'Joanna';
					handleConfigChange();
				}}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
				</svg>
				AWS Polly
			</button>
			<button
				class="btn btn-sm join-item flex-1"
				class:btn-active={config.provider === 'browser'}
				onclick={() => {
					config.provider = 'browser';
					// Always set a browser voice when switching to browser provider
					if (browserVoices.length > 0) {
						config.voice = browserVoices[0].name;
					} else {
						// Fallback to empty string if voices aren't loaded yet
						// The browser TTS will use the default voice
						config.voice = '';
					}
					handleConfigChange();
				}}
			>
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
				</svg>
				Browser
			</button>
		</div>
		<div class="label">
			<span class="label-text-alt text-xs opacity-70">
				{#if config.provider === 'polly'}
					Server-side synthesis with speech marks (AWS)
				{:else}
					Client-side synthesis (Web Speech API)
				{/if}
			</span>
		</div>
	</div>

	<!-- Provider-specific settings -->
	{#if config.provider === 'polly'}
		<!-- AWS Polly Settings -->
		<div class="space-y-3 p-4 bg-base-200 rounded-lg">
			<div class="flex items-center gap-2 mb-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
				<span class="text-sm font-semibold">AWS Polly Extensions</span>
			</div>

			<!-- Engine Selection -->
			<div class="form-control">
				<div class="label">
					<span class="label-text">Engine</span>
					<span class="label-text-alt text-xs">
						{config.pollyEngine === 'neural' ? '$16/1M chars' : '$4/1M chars'}
					</span>
				</div>
				<div class="join w-full" role="group" aria-label="Polly Engine Selection">
					<button
						class="btn btn-sm join-item flex-1"
						class:btn-active={config.pollyEngine === 'neural'}
						onclick={() => {
							config.pollyEngine = 'neural';
							handleConfigChange();
						}}
					>
						Neural
					</button>
					<button
						class="btn btn-sm join-item flex-1"
						class:btn-active={config.pollyEngine === 'standard'}
						onclick={() => {
							config.pollyEngine = 'standard';
							handleConfigChange();
						}}
					>
						Standard
					</button>
				</div>
			</div>

			<!-- Sample Rate -->
			<div class="form-control">
				<div class="label">
					<span class="label-text">Sample Rate</span>
					<span class="label-text-alt text-xs">{config.pollySampleRate} Hz</span>
				</div>
				<div class="join w-full">
					{#each [8000, 16000, 22050, 24000] as rate}
						<button
							class="btn btn-xs join-item flex-1"
							class:btn-active={config.pollySampleRate === rate}
							onclick={() => {
								config.pollySampleRate = rate;
								handleConfigChange();
							}}
						>
							{rate / 1000}k
						</button>
					{/each}
				</div>
			</div>

			<!-- Voice Selection -->
			<div class="form-control">
				<label class="label" for="polly-voice-select">
					<span class="label-text">Voice</span>
					{#if loadingVoices}
						<span class="label-text-alt text-xs">
							<span class="loading loading-spinner loading-xs"></span>
							Loading voices...
						</span>
					{:else if voicesError}
						<span class="label-text-alt text-xs text-error">{voicesError}</span>
					{:else}
						<span class="label-text-alt text-xs">{filteredVoices.length} available</span>
					{/if}
				</label>
				<select
					id="polly-voice-select"
					class="select select-sm select-bordered w-full"
					bind:value={config.voice}
					onchange={handleConfigChange}
					disabled={loadingVoices}
				>
					{#if loadingVoices}
						<option>Loading voices...</option>
					{:else if voicesError}
						<option>{config.voice}</option>
					{:else}
						{#each filteredVoices as voice}
							<option value={voice.id}>
								{voice.name} ({voice.languageCode}) {voice.gender ? `- ${voice.gender}` : ''}
							</option>
						{/each}
					{/if}
				</select>
			</div>
		</div>
	{:else}
		<!-- Browser TTS Settings -->
		<div class="space-y-3 p-4 bg-base-200 rounded-lg">
			<div class="flex items-center gap-2 mb-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-sm font-semibold">W3C Web Speech API</span>
			</div>

			<!-- Voice Selection -->
			<div class="form-control">
				<label class="label" for="browser-voice-select">
					<span class="label-text">Voice</span>
					<span class="label-text-alt text-xs">{browserVoices.length} available</span>
				</label>
				<select
					id="browser-voice-select"
					class="select select-sm select-bordered w-full"
					bind:value={config.voice}
					onchange={handleConfigChange}
				>
					{#if browserVoices.length === 0}
						<option>Loading voices...</option>
					{:else}
						{#each browserVoices as voice}
							<option value={voice.name}>
								{voice.name} ({voice.lang})
							</option>
						{/each}
					{/if}
				</select>
			</div>
		</div>
	{/if}

	<!-- Standard W3C Parameters (shared by all providers) -->
	<div class="space-y-3">
		<div class="divider text-xs">
			<span class="badge badge-xs badge-outline">W3C Standard Parameters</span>
		</div>

		<!-- Rate Control -->
		<div class="form-control">
			<label class="label" for="tts-rate-control">
				<span class="label-text">Rate (Speed)</span>
				<span class="label-text-alt text-xs font-mono">{config.rate.toFixed(2)}x</span>
			</label>
			<input
				id="tts-rate-control"
				type="range"
				min="0.25"
				max="4"
				step="0.05"
				class="range range-sm"
				bind:value={config.rate}
				oninput={handleConfigChange}
			/>
			<div class="flex justify-between text-xs px-1 opacity-60">
				<span>0.25x</span>
				<span>1x</span>
				<span>2x</span>
				<span>4x</span>
			</div>
		</div>

		<!-- Pitch Control -->
		<div class="form-control">
			<label class="label" for="tts-pitch-control">
				<span class="label-text">Pitch</span>
				<span class="label-text-alt text-xs font-mono">{config.pitch.toFixed(2)}</span>
			</label>
			<input
				id="tts-pitch-control"
				type="range"
				min="0"
				max="2"
				step="0.05"
				class="range range-sm"
				bind:value={config.pitch}
				oninput={handleConfigChange}
			/>
			<div class="flex justify-between text-xs px-1 opacity-60">
				<span>0 (low)</span>
				<span>1 (normal)</span>
				<span>2 (high)</span>
			</div>
		</div>

		<!-- Voice Preview -->
		{#if ttsService}
			<div class="form-control">
				<button
					class="btn btn-sm btn-primary w-full gap-2"
					onclick={previewVoice}
					disabled={isPreviewing}
				>
					{#if isPreviewing}
						<span class="loading loading-spinner loading-xs"></span>
						Playing...
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
						</svg>
						Preview Voice
					{/if}
				</button>
				<div class="label">
					<span class="label-text-alt text-xs opacity-70 text-center w-full">
						Hear how your selected voice and settings will sound
					</span>
				</div>
			</div>
		{/if}

		<!-- Reset to Defaults -->
		<button
			class="btn btn-xs btn-ghost w-full"
			onclick={() => {
				config.rate = 1.0;
				config.pitch = 1.0;
				if (config.provider === 'polly') {
					config.voice = 'Joanna';
					config.pollyEngine = 'neural';
					config.pollySampleRate = 24000;
				}
				handleConfigChange();
			}}
		>
			Reset to Defaults
		</button>
	</div>

	<!-- Provider Capabilities Info -->
	<div class="alert alert-info text-xs p-3">
		<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
		</svg>
		<div class="text-left">
			{#if config.provider === 'polly'}
				<div class="font-semibold mb-1">AWS Polly Features:</div>
				<ul class="list-disc list-inside space-y-0.5 opacity-80">
					<li>Speech marks for word highlighting</li>
					<li>Full SSML support + AWS extensions</li>
					<li>Neural and standard engines</li>
					<li>60+ voices, 25+ languages</li>
				</ul>
			{:else}
				<div class="font-semibold mb-1">Browser TTS Features:</div>
				<ul class="list-disc list-inside space-y-0.5 opacity-80">
					<li>System voices (varies by OS)</li>
					<li>Limited SSML support</li>
					<li>No speech marks (basic highlighting)</li>
					<li>Free, works offline</li>
				</ul>
			{/if}
		</div>
	</div>
</div>

<style>
	.tts-settings {
		max-width: 100%;
	}

	.range {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.range:hover {
		opacity: 0.8;
	}

	.range::-webkit-slider-thumb {
		transition: transform 0.2s ease;
	}

	.range::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.range::-moz-range-thumb {
		transition: transform 0.2s ease;
	}

	.range::-moz-range-thumb:hover {
		transform: scale(1.2);
	}

	.divider {
		margin: 0.5rem 0;
	}

	/* Button enhancements */
	.btn {
		transition: all 0.2s ease;
	}

	.btn:not(:disabled):hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.btn:not(:disabled):active {
		transform: translateY(0);
	}

	/* Form control enhancements */
	.form-control {
		transition: opacity 0.2s ease;
	}

	/* Alert pulse animation */
	.alert {
		animation: fadeIn 0.3s ease-in;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Provider section background animation */
	.bg-base-200 {
		transition: background-color 0.3s ease;
	}

	/* Select hover effect */
	.select:hover:not(:disabled) {
		border-color: var(--fallback-bc, oklch(var(--bc) / 0.4));
	}

	.select:focus {
		outline-offset: 2px;
	}
</style>
