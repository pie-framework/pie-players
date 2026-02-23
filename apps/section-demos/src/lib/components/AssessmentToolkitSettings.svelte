<script lang="ts">
	import { untrack } from 'svelte';
	import type { TTSService } from '@pie-players/pie-assessment-toolkit';

	let {
		ttsService,
		ttsConfig = $bindable({
			provider: 'browser' as 'polly' | 'browser' | 'google',
			voice: '',
			rate: 1.0,
			pitch: 1.0,
			pollyEngine: 'neural' as 'neural' | 'standard',
			pollySampleRate: 24000,
			googleVoiceType: 'wavenet' as 'wavenet' | 'standard' | 'studio',
			highlightStyle: {
				color: '#ffeb3b',
				opacity: 0.4
			}
		}),
		layoutConfig = $bindable({
			toolbarPosition: 'right' as 'top' | 'right' | 'bottom' | 'left'
		}),
		onClose,
		onApply
	}: {
		ttsService?: TTSService;
		ttsConfig?: {
			provider: 'polly' | 'browser' | 'google';
			voice: string;
			rate: number;
			pitch: number;
			pollyEngine?: 'neural' | 'standard';
			pollySampleRate?: number;
			googleVoiceType?: 'wavenet' | 'standard' | 'studio';
			highlightStyle?: {
				color: string;
				opacity: number;
			};
		};
		layoutConfig?: {
			toolbarPosition: 'top' | 'right' | 'bottom' | 'left';
		};
		onClose?: () => void;
		onApply?: (settings: { tts: typeof ttsConfig; layout: typeof layoutConfig }) => void;
	} = $props();

	// Active tab
	let activeTab = $state<'tts' | 'highlight' | 'layout'>('tts');

	// Local copies for editing
	type NormalizedTtsConfig = {
		provider: 'polly' | 'browser' | 'google';
		voice: string;
		rate: number;
		pitch: number;
		pollyEngine?: 'neural' | 'standard';
		pollySampleRate?: number;
		googleVoiceType?: 'wavenet' | 'standard' | 'studio';
		highlightStyle: {
			color: string;
			opacity: number;
		};
	};

	function normalizeTtsConfig(config: Partial<NormalizedTtsConfig> = {}): NormalizedTtsConfig {
		return {
			provider: 'browser' as 'polly' | 'browser' | 'google',
			voice: '',
			rate: 1.0,
			pitch: 1.0,
			pollyEngine: 'neural' as 'neural' | 'standard',
			pollySampleRate: 24000,
			googleVoiceType: 'wavenet' as 'wavenet' | 'standard' | 'studio',
			...config,
			highlightStyle: {
				color: '#ffeb3b',
				opacity: 0.4,
				...(config?.highlightStyle || {})
			}
		};
	}

	let localTtsConfig = $state(normalizeTtsConfig(ttsConfig || {}));
	let localLayoutConfig = $state({ ...layoutConfig });

	// Voice options
	let browserVoices = $state<SpeechSynthesisVoice[]>([]);
	let voicesLoaded = $state(false);

	// Server-based TTS voices
	type VoiceInfo = {
		id: string;
		name: string;
		language: string;
		gender?: 'male' | 'female' | 'neutral';
		quality?: 'standard' | 'neural' | 'premium';
	};

	let pollyVoices = $state<VoiceInfo[]>([]);
	let googleVoices = $state<VoiceInfo[]>([]);
	let pollyVoicesLoading = $state(false);
	let googleVoicesLoading = $state(false);

	// Map googleVoiceType to quality values
	const voiceTypeToQuality = {
		'wavenet': 'neural' as const,
		'studio': 'premium' as const,
		'standard': 'standard' as const
	};

	// Filter Google voices by selected type
	let filteredGoogleVoices = $derived(
		googleVoices.filter(v =>
			!localTtsConfig.googleVoiceType ||
			v.quality === voiceTypeToQuality[localTtsConfig.googleVoiceType]
		)
	);

	// Load browser voices
	$effect(() => {
		if (typeof window !== 'undefined' && window.speechSynthesis) {
			const loadVoices = () => {
				browserVoices = window.speechSynthesis.getVoices();
				voicesLoaded = true;
			};

			loadVoices();
			window.speechSynthesis.onvoiceschanged = loadVoices;
		}
	});

	// Fetch Polly voices dynamically
	async function fetchPollyVoices() {
		pollyVoicesLoading = true;
		try {
			const response = await fetch('/api/tts/polly/voices?language=en-US');
			if (response.ok) {
				const data = await response.json();
				pollyVoices = data.voices || [];
			} else {
				console.error('Failed to fetch Polly voices:', await response.text());
			}
		} catch (error) {
			console.error('Error fetching Polly voices:', error);
		} finally {
			pollyVoicesLoading = false;
		}
	}

	// Fetch Google voices dynamically (fetch all, filter client-side)
	async function fetchGoogleVoices() {
		googleVoicesLoading = true;
		try {
			const response = await fetch('/api/tts/google/voices?language=en-US');
			if (response.ok) {
				const data = await response.json();
				googleVoices = data.voices || [];
			} else {
				console.error('Failed to fetch Google voices:', await response.text());
			}
		} catch (error) {
			console.error('Error fetching Google voices:', error);
		} finally {
			googleVoicesLoading = false;
		}
	}

	// Load voices when provider changes
	$effect(() => {
		if (localTtsConfig.provider === 'polly' && pollyVoices.length === 0) {
			fetchPollyVoices();
		} else if (localTtsConfig.provider === 'google' && googleVoices.length === 0) {
			fetchGoogleVoices();
		}
	});

	// Filtered browser voices (English only)
	let englishVoices = $derived(browserVoices.filter((v) => v.lang.startsWith('en')));

	// Update Google voice when voice type changes
	$effect(() => {
		if (localTtsConfig.provider === 'google' && localTtsConfig.googleVoiceType) {
			const voicesOfType = filteredGoogleVoices;
			if (voicesOfType.length > 0 && !voicesOfType.some(v => v.id === localTtsConfig.voice)) {
				// Current voice is not available for this type, switch to first available
				localTtsConfig.voice = voicesOfType[0].id;
			}
		}
	});

	// TTS Engine availability testing
	let engineTestStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let engineTestMessage = $state<string>('');
	let engineTestTimeout: ReturnType<typeof setTimeout> | null = null;
	let lastTestedProvider = $state<string>('');

	// Test TTS engine when provider changes
	$effect(() => {
		const provider = localTtsConfig.provider;

		// Only test if provider actually changed
		if (provider === lastTestedProvider) {
			return;
		}

		lastTestedProvider = provider;

		// Clear any existing timeout
		if (engineTestTimeout) {
			clearTimeout(engineTestTimeout);
			engineTestTimeout = null;
		}

		// Reset status when provider changes
		engineTestStatus = 'testing';
		engineTestMessage = 'Testing engine availability...';

		// Test the engine asynchronously
		// We don't await this to avoid blocking the effect
		testEngineAvailability(provider);
	});

	function getProviderName(provider: 'polly' | 'browser' | 'google'): string {
		switch (provider) {
			case 'polly': return 'AWS Polly';
			case 'google': return 'Google Cloud TTS';
			case 'browser': return 'Browser TTS';
		}
	}

	function parseErrorMessage(response: Response, errorText: string, provider: 'polly' | 'browser' | 'google'): string {
		const providerName = getProviderName(provider);

		// Check if it's an HTML error page (starts with <!doctype or <html)
		if (errorText.trim().toLowerCase().startsWith('<!doctype') || errorText.trim().toLowerCase().startsWith('<html')) {
			// It's an HTML error page, provide a generic but helpful message based on status
			if (response.status === 404) {
				return `${providerName} API endpoint not found. Please ensure the TTS server is running.`;
			} else if (response.status === 401 || response.status === 403) {
				return `${providerName} authentication failed. Please check your API credentials.`;
			} else if (response.status === 500) {
				return `${providerName} server error. Please check server logs for details.`;
			} else if (response.status >= 500) {
				return `${providerName} server error (${response.status}). Service may be unavailable.`;
			} else {
				return `${providerName} unavailable (${response.status} ${response.statusText})`;
			}
		}

		// Try to parse as JSON for structured error messages
		try {
			const errorJson = JSON.parse(errorText);
			if (errorJson.error) {
				return `${providerName}: ${errorJson.error}`;
			} else if (errorJson.message) {
				return `${providerName}: ${errorJson.message}`;
			}
		} catch {
			// Not JSON, use the text as-is if it's short and readable
			if (errorText.length < 100 && !errorText.includes('<')) {
				return `${providerName}: ${errorText}`;
			}
		}

		// Fallback for other cases
		return `${providerName} unavailable (${response.status} ${response.statusText})`;
	}

	async function testEngineAvailability(provider: 'polly' | 'browser' | 'google') {
		try {
			if (provider === 'browser') {
				// Browser TTS is always available if speechSynthesis exists
				if (typeof window !== 'undefined' && window.speechSynthesis) {
					untrack(() => {
						engineTestStatus = 'success';
						engineTestMessage = 'Browser TTS is available';
					});
				} else {
					untrack(() => {
						engineTestStatus = 'error';
						engineTestMessage = 'Browser TTS not supported by this browser';
					});
				}
			} else {
				// For server-based TTS (Polly and Google), test the endpoint
				const testEndpoint = provider === 'polly'
					? '/api/tts/polly/voices'
					: '/api/tts/google/voices';

				const response = await fetch(testEndpoint, {
					method: 'GET',
					headers: { 'Content-Type': 'application/json' }
				});

				if (response.ok) {
					untrack(() => {
						engineTestStatus = 'success';
						engineTestMessage = `${getProviderName(provider)} is configured and available`;
					});
				} else {
					const errorText = await response.text();
					untrack(() => {
						engineTestStatus = 'error';
						engineTestMessage = parseErrorMessage(response, errorText, provider);
					});
				}
			}
		} catch (error) {
			untrack(() => {
				engineTestStatus = 'error';
				const providerName = getProviderName(provider);

				if (error instanceof TypeError && error.message.includes('fetch')) {
					engineTestMessage = `${providerName} server unreachable. Please ensure the TTS server is running.`;
				} else if (error instanceof Error) {
					engineTestMessage = `${providerName}: ${error.message}`;
				} else {
					engineTestMessage = `${providerName} unavailable due to network error`;
				}
			});
		}

		// Auto-hide success message after 3 seconds
		untrack(() => {
			if (engineTestStatus === 'success') {
				engineTestTimeout = setTimeout(() => {
					untrack(() => {
						engineTestStatus = 'idle';
						engineTestMessage = '';
					});
				}, 3000);
			}
		});
	}

	function handleApply() {
		if (onApply) {
			onApply({
				tts: localTtsConfig,
				layout: localLayoutConfig
			});
		}
	}

	function handleReset() {
		localTtsConfig = normalizeTtsConfig({
			provider: 'browser',
			voice: '',
			rate: 1.0,
			pitch: 1.0
		});
		localLayoutConfig = {
			toolbarPosition: 'right'
		};
	}

	// Preset colors for highlighting
	const highlightPresets = [
		{ name: 'Yellow', color: '#ffeb3b' },
		{ name: 'Green', color: '#8bc34a' },
		{ name: 'Blue', color: '#2196f3' },
		{ name: 'Pink', color: '#e91e63' },
		{ name: 'Orange', color: '#ff9800' },
		{ name: 'Purple', color: '#9c27b0' }
	];
</script>

<div class="modal modal-open">
	<div class="modal-box max-w-4xl h-[80vh] flex flex-col p-0">
		<!-- Header -->
		<div class="flex items-center justify-between p-6 border-b">
			<h3 class="font-bold text-lg">Assessment Toolkit Settings</h3>
			<button class="btn btn-sm btn-circle btn-ghost" onclick={onClose}>✕</button>
		</div>

		<!-- Tabs -->
		<div role="tablist" class="tabs tabs-boxed m-4">
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'tts'}
				onclick={() => (activeTab = 'tts')}
			>
				Text-to-Speech
			</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'highlight'}
				onclick={() => (activeTab = 'highlight')}
			>
				Highlighting
			</button>
			<button
				type="button"
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'layout'}
				onclick={() => (activeTab = 'layout')}
			>
				Layout
			</button>
		</div>

		<!-- Tab Content -->
		<div class="flex-1 overflow-y-auto px-6 pb-4">
			{#if activeTab === 'tts'}
				<!-- TTS Settings -->
				<div class="space-y-4">
					<h4 class="font-semibold text-base">Text-to-Speech Configuration</h4>

					<!-- Provider Selection -->
					<div class="form-control">
						<div class="label">
							<span class="label-text font-semibold">TTS Provider</span>
						</div>
						<div class="grid grid-cols-3 gap-3">
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="polly"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">AWS Polly</div>
									<div class="text-sm opacity-70">High-quality neural voices</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="google"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Google Cloud</div>
									<div class="text-sm opacity-70">WaveNet & Studio voices</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="browser"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Browser TTS</div>
									<div class="text-sm opacity-70">Free, uses system voices</div>
								</span>
							</label>
						</div>

						<!-- Engine Test Status -->
						{#if engineTestStatus !== 'idle'}
							<div class="alert mt-2" class:alert-info={engineTestStatus === 'testing'} class:alert-success={engineTestStatus === 'success'} class:alert-error={engineTestStatus === 'error'}>
								<div class="flex items-center gap-2">
									{#if engineTestStatus === 'testing'}
										<span class="loading loading-spinner loading-sm"></span>
									{:else if engineTestStatus === 'success'}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
										</svg>
									{:else}
										<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
											<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
										</svg>
									{/if}
									<span class="text-sm">{engineTestMessage}</span>
								</div>
							</div>
						{/if}
					</div>

					{#if localTtsConfig.provider === 'polly'}
						<!-- Polly Settings -->
						<div class="form-control">
							<label class="label" for="polly-voice-select">
								<span class="label-text">
									Voice {pollyVoicesLoading ? '(Loading...)' : `(${pollyVoices.length} available)`}
								</span>
							</label>
							<select id="polly-voice-select" bind:value={localTtsConfig.voice} class="select select-bordered w-full" disabled={pollyVoicesLoading}>
								{#each pollyVoices as voice}
									<option value={voice.id}>
										{voice.name}
										{#if voice.gender}({voice.gender}){/if}
									</option>
								{/each}
							</select>
						</div>

						<div class="form-control">
							<label class="label" for="polly-engine-select">
								<span class="label-text">Engine</span>
							</label>
							<select id="polly-engine-select" bind:value={localTtsConfig.pollyEngine} class="select select-bordered w-full">
								<option value="neural">Neural (Best Quality)</option>
								<option value="standard">Standard</option>
							</select>
						</div>

						<div class="form-control">
							<label class="label" for="polly-sample-rate-select">
								<span class="label-text">Sample Rate</span>
							</label>
							<select
								id="polly-sample-rate-select"
								bind:value={localTtsConfig.pollySampleRate}
								class="select select-bordered w-full"
							>
								<option value={24000}>24kHz (Recommended)</option>
								<option value={22050}>22.05kHz</option>
								<option value={16000}>16kHz</option>
								<option value={8000}>8kHz</option>
							</select>
						</div>
					{:else if localTtsConfig.provider === 'google'}
						<!-- Google Cloud TTS Settings -->
						<div class="form-control">
							<label class="label" for="google-voice-type-select">
								<span class="label-text">Voice Type</span>
							</label>
							<select id="google-voice-type-select" bind:value={localTtsConfig.googleVoiceType} class="select select-bordered w-full">
								<option value="wavenet">WaveNet (Neural, Recommended)</option>
								<option value="studio">Studio (Premium Quality)</option>
								<option value="standard">Standard</option>
							</select>
						</div>

						<div class="form-control">
							<label class="label" for="google-voice-select">
								<span class="label-text">
									Voice {googleVoicesLoading ? '(Loading...)' : `(${filteredGoogleVoices.length} available)`}
								</span>
							</label>
							<select id="google-voice-select" bind:value={localTtsConfig.voice} class="select select-bordered w-full" disabled={googleVoicesLoading}>
								{#each filteredGoogleVoices as voice}
									<option value={voice.id}>
										{voice.name}
										{#if voice.gender}({voice.gender}){/if}
									</option>
								{/each}
							</select>
						</div>
					{:else}
						<!-- Browser TTS Settings -->
						<div class="form-control">
							<label class="label" for="browser-voice-select">
								<span class="label-text">
									Voice {voicesLoaded ? `(${englishVoices.length} available)` : '(Loading...)'}
								</span>
							</label>
							<select id="browser-voice-select" bind:value={localTtsConfig.voice} class="select select-bordered w-full">
								<option value="">Default</option>
								{#each englishVoices as voice}
									<option value={voice.name}>{voice.name} ({voice.lang})</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Common Settings -->
					<div class="form-control">
						<label class="label" for="speech-rate-input">
							<span class="label-text">Speech Rate: {localTtsConfig.rate.toFixed(1)}x</span>
						</label>
						<input
							id="speech-rate-input"
							type="range"
							bind:value={localTtsConfig.rate}
							min="0.5"
							max="2.0"
							step="0.1"
							class="range range-primary"
							aria-label="Speech rate"
						/>
						<div class="w-full flex justify-between text-xs px-2 opacity-60">
							<span>Slower</span>
							<span>Normal</span>
							<span>Faster</span>
						</div>
					</div>

					<div class="form-control">
						<label class="label" for="pitch-input">
							<span class="label-text">Pitch: {localTtsConfig.pitch.toFixed(1)}x</span>
						</label>
						<input
							id="pitch-input"
							type="range"
							bind:value={localTtsConfig.pitch}
							min="0.5"
							max="2.0"
							step="0.1"
							class="range range-primary"
							aria-label="Pitch"
						/>
						<div class="w-full flex justify-between text-xs px-2 opacity-60">
							<span>Lower</span>
							<span>Normal</span>
							<span>Higher</span>
						</div>
					</div>
				</div>
			{:else if activeTab === 'highlight'}
				<!-- Highlighting Settings -->
				<div class="space-y-4">
					<h4 class="font-semibold text-base">TTS Highlight Style</h4>
					<div class="text-sm opacity-80">
						These settings control highlight styling used during text-to-speech playback.
					</div>

					<div class="form-control">
						<div class="label">
							<span class="label-text">Highlight Color</span>
						</div>
						<div class="flex gap-2 flex-wrap">
							{#each highlightPresets as preset}
								<button
									type="button"
									class="btn btn-square"
									class:btn-outline={localTtsConfig.highlightStyle.color !== preset.color}
									style="background-color: {preset.color}; border-color: {preset.color};"
									onclick={(e) => {
										e.stopPropagation();
										localTtsConfig.highlightStyle.color = preset.color;
									}}
									title={preset.name}
								>
									{#if localTtsConfig.highlightStyle.color === preset.color}
										<span class="text-white text-xl">✓</span>
									{/if}
								</button>
							{/each}
							<input
								type="color"
								bind:value={localTtsConfig.highlightStyle.color}
								class="btn btn-square"
								title="Custom color"
							/>
						</div>
					</div>

					<div class="form-control">
						<label class="label" for="highlight-opacity-input">
							<span class="label-text">
								Opacity: {Math.round(localTtsConfig.highlightStyle.opacity * 100)}%
							</span>
						</label>
						<input
							id="highlight-opacity-input"
							type="range"
							bind:value={localTtsConfig.highlightStyle.opacity}
							min="0.1"
							max="1.0"
							step="0.1"
							class="range range-primary"
							aria-label="Highlight opacity"
						/>
						<div class="w-full flex justify-between text-xs px-2 opacity-60">
							<span>Subtle</span>
							<span>Medium</span>
							<span>Bold</span>
						</div>
					</div>

					<!-- Preview -->
					<div class="alert">
						<div>
							<div class="text-sm">
								This is a preview of how highlighted text will appear.
								<span
									class="px-1 rounded"
									style="background-color: {localTtsConfig.highlightStyle.color}; opacity: {localTtsConfig.highlightStyle.opacity};"
								>
									Sample highlighted text
								</span>
								in the assessment.
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'layout'}
				<!-- Layout Settings -->
				<div class="space-y-4">
					<h4 class="font-semibold text-base">Layout Configuration</h4>

					<!-- Toolbar Position -->
					<div class="form-control">
						<div class="label">
							<span class="label-text font-semibold">Tools Toolbar Position</span>
						</div>
						<div class="label">
							<span class="label-text-alt">Choose where the floating tools toolbar appears</span>
						</div>
						<div class="grid grid-cols-2 gap-3 mt-2">
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localLayoutConfig.toolbarPosition}
									value="top"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Top</div>
									<div class="text-sm opacity-70">Toolbar at top of content</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localLayoutConfig.toolbarPosition}
									value="right"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Right</div>
									<div class="text-sm opacity-70">Toolbar on right side (default)</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localLayoutConfig.toolbarPosition}
									value="bottom"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Bottom</div>
									<div class="text-sm opacity-70">Toolbar at bottom of content</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 border rounded-lg p-4 flex-col items-start">
								<input
									type="radio"
									bind:group={localLayoutConfig.toolbarPosition}
									value="left"
									class="radio"
								/>
								<span class="label-text">
									<div class="font-semibold">Left</div>
									<div class="text-sm opacity-70">Toolbar on left side</div>
								</span>
							</label>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="border-t p-4 flex justify-between items-center">
			<button type="button" class="btn btn-ghost" onclick={handleReset}>Reset to Defaults</button>
			<div class="flex gap-2">
				<button type="button" class="btn" onclick={onClose}>Cancel</button>
				<button type="button" class="btn btn-primary" onclick={handleApply}>Apply Settings</button>
			</div>
		</div>
	</div>
	<button class="modal-backdrop" onclick={onClose} aria-label="Close settings modal"></button>
</div>
