<script lang="ts">
	import type { TTSService } from '@pie-players/pie-assessment-toolkit';

	let {
		ttsService,
		ttsConfig = $bindable({
			provider: 'polly' as 'polly' | 'browser',
			voice: 'Joanna',
			rate: 1.0,
			pitch: 1.0,
			pollyEngine: 'neural' as 'neural' | 'standard',
			pollySampleRate: 24000
		}),
		highlightConfig = $bindable({
			enabled: true,
			color: '#ffeb3b',
			opacity: 0.4
		}),
		onClose,
		onApply
	}: {
		ttsService?: TTSService;
		ttsConfig?: {
			provider: 'polly' | 'browser';
			voice: string;
			rate: number;
			pitch: number;
			pollyEngine?: 'neural' | 'standard';
			pollySampleRate?: number;
		};
		highlightConfig?: {
			enabled: boolean;
			color: string;
			opacity: number;
		};
		onClose?: () => void;
		onApply?: (settings: { tts: typeof ttsConfig; highlight: typeof highlightConfig }) => void;
	} = $props();

	// Active tab
	let activeTab = $state<'tts' | 'highlight'>('tts');

	// Local copies for editing
	let localTtsConfig = $state({ ...ttsConfig });
	let localHighlightConfig = $state({ ...highlightConfig });

	// Voice options
	let browserVoices = $state<SpeechSynthesisVoice[]>([]);
	let voicesLoaded = $state(false);

	// Polly voices (simplified list)
	const pollyVoices = [
		{ name: 'Joanna', language: 'en-US', gender: 'Female' },
		{ name: 'Matthew', language: 'en-US', gender: 'Male' },
		{ name: 'Ivy', language: 'en-US', gender: 'Female (Child)' },
		{ name: 'Joey', language: 'en-US', gender: 'Male (Child)' },
		{ name: 'Kendra', language: 'en-US', gender: 'Female' },
		{ name: 'Kimberly', language: 'en-US', gender: 'Female' },
		{ name: 'Salli', language: 'en-US', gender: 'Female' },
		{ name: 'Justin', language: 'en-US', gender: 'Male (Child)' },
		{ name: 'Ruth', language: 'en-US', gender: 'Female' },
		{ name: 'Stephen', language: 'en-US', gender: 'Male' }
	];

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

	// Filtered browser voices (English only)
	let englishVoices = $derived(browserVoices.filter((v) => v.lang.startsWith('en')));

	function handleApply() {
		if (onApply) {
			onApply({
				tts: localTtsConfig,
				highlight: localHighlightConfig
			});
		}
	}

	function handleReset() {
		localTtsConfig = {
			provider: 'polly',
			voice: 'Joanna',
			rate: 1.0,
			pitch: 1.0,
			pollyEngine: 'neural',
			pollySampleRate: 24000
		};
		localHighlightConfig = {
			enabled: true,
			color: '#ffeb3b',
			opacity: 0.4
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
		</div>

		<!-- Tab Content -->
		<div class="flex-1 overflow-y-auto px-6 pb-4">
			{#if activeTab === 'tts'}
				<!-- TTS Settings -->
				<div class="space-y-4">
					<h4 class="font-semibold text-base">Text-to-Speech Configuration</h4>

					<!-- Provider Selection -->
					<div class="form-control">
						<label class="label">
							<span class="label-text font-semibold">TTS Provider</span>
						</label>
						<div class="flex gap-4">
							<label class="label cursor-pointer gap-2 flex-1 border rounded-lg p-4">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="polly"
									class="radio"
								/>
								<span class="label-text flex-1">
									<div class="font-semibold">AWS Polly</div>
									<div class="text-sm opacity-70">High-quality neural voices</div>
								</span>
							</label>
							<label class="label cursor-pointer gap-2 flex-1 border rounded-lg p-4">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="browser"
									class="radio"
								/>
								<span class="label-text flex-1">
									<div class="font-semibold">Browser TTS</div>
									<div class="text-sm opacity-70">Free, uses system voices</div>
								</span>
							</label>
						</div>
					</div>

					{#if localTtsConfig.provider === 'polly'}
						<!-- Polly Settings -->
						<div class="form-control">
							<label class="label">
								<span class="label-text">Voice</span>
							</label>
							<select bind:value={localTtsConfig.voice} class="select select-bordered w-full">
								{#each pollyVoices as voice}
									<option value={voice.name}>{voice.name} ({voice.gender})</option>
								{/each}
							</select>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">Engine</span>
							</label>
							<select bind:value={localTtsConfig.pollyEngine} class="select select-bordered w-full">
								<option value="neural">Neural (Best Quality)</option>
								<option value="standard">Standard</option>
							</select>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">Sample Rate</span>
							</label>
							<select
								bind:value={localTtsConfig.pollySampleRate}
								class="select select-bordered w-full"
							>
								<option value={24000}>24kHz (Recommended)</option>
								<option value={22050}>22.05kHz</option>
								<option value={16000}>16kHz</option>
								<option value={8000}>8kHz</option>
							</select>
						</div>
					{:else}
						<!-- Browser TTS Settings -->
						<div class="form-control">
							<label class="label">
								<span class="label-text">
									Voice {voicesLoaded ? `(${englishVoices.length} available)` : '(Loading...)'}
								</span>
							</label>
							<select bind:value={localTtsConfig.voice} class="select select-bordered w-full">
								<option value="">Default</option>
								{#each englishVoices as voice}
									<option value={voice.name}>{voice.name} ({voice.lang})</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Common Settings -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Speech Rate: {localTtsConfig.rate.toFixed(1)}x</span>
						</label>
						<input
							type="range"
							bind:value={localTtsConfig.rate}
							min="0.5"
							max="2.0"
							step="0.1"
							class="range range-primary"
						/>
						<div class="w-full flex justify-between text-xs px-2 opacity-60">
							<span>Slower</span>
							<span>Normal</span>
							<span>Faster</span>
						</div>
					</div>

					<div class="form-control">
						<label class="label">
							<span class="label-text">Pitch: {localTtsConfig.pitch.toFixed(1)}x</span>
						</label>
						<input
							type="range"
							bind:value={localTtsConfig.pitch}
							min="0.5"
							max="2.0"
							step="0.1"
							class="range range-primary"
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
					<h4 class="font-semibold text-base">Text Highlighting Configuration</h4>

					<div class="form-control">
						<label class="label cursor-pointer justify-start gap-3">
							<input type="checkbox" bind:checked={localHighlightConfig.enabled} class="checkbox" />
							<span class="label-text">Enable text highlighting</span>
						</label>
						<label class="label">
							<span class="label-text-alt">Allow students to highlight text in passages and questions</span>
						</label>
					</div>

					{#if localHighlightConfig.enabled}
						<div class="form-control">
							<label class="label">
								<span class="label-text">Highlight Color</span>
							</label>
							<div class="flex gap-2 flex-wrap">
								{#each highlightPresets as preset}
									<button
										type="button"
										class="btn btn-square"
										class:btn-outline={localHighlightConfig.color !== preset.color}
										style="background-color: {preset.color}; border-color: {preset.color};"
										onclick={(e) => {
											e.stopPropagation();
											localHighlightConfig.color = preset.color;
										}}
										title={preset.name}
									>
										{#if localHighlightConfig.color === preset.color}
											<span class="text-white text-xl">✓</span>
										{/if}
									</button>
								{/each}
								<input
									type="color"
									bind:value={localHighlightConfig.color}
									class="btn btn-square"
									title="Custom color"
								/>
							</div>
						</div>

						<div class="form-control">
							<label class="label">
								<span class="label-text">
									Opacity: {Math.round(localHighlightConfig.opacity * 100)}%
								</span>
							</label>
							<input
								type="range"
								bind:value={localHighlightConfig.opacity}
								min="0.1"
								max="1.0"
								step="0.1"
								class="range range-primary"
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
										style="background-color: {localHighlightConfig.color}; opacity: {localHighlightConfig.opacity};"
									>
										Sample highlighted text
									</span>
									in the assessment.
								</div>
							</div>
						</div>
					{/if}
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
	<button class="modal-backdrop" onclick={onClose}></button>
</div>
