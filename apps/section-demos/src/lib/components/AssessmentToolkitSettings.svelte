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
		onApply?: (settings: {
			tts: typeof ttsConfig;
			highlight: typeof highlightConfig;
		}) => void;
	} = $props();

	// Active tab
	let activeTab = $state<'tts' | 'highlight' | 'tools' | 'accessibility'>('tts');

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

<div class="modal-backdrop" onclick={onClose} role="presentation">
	<div class="modal-content" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
		<div class="modal-header">
			<h2>Assessment Toolkit Settings</h2>
			<button class="close-button" onclick={onClose} aria-label="Close settings">×</button>
		</div>

		<!-- Tabs -->
		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'tts'}
				onclick={() => (activeTab = 'tts')}
			>
				<span class="tab-icon">🔊</span>
				Text-to-Speech
			</button>
			<button
				class="tab"
				class:active={activeTab === 'highlight'}
				onclick={() => (activeTab = 'highlight')}
			>
				<span class="tab-icon">✏️</span>
				Highlighting
			</button>
			<button
				class="tab"
				class:active={activeTab === 'tools'}
				onclick={() => (activeTab = 'tools')}
			>
				<span class="tab-icon">🧰</span>
				Tools
			</button>
			<button
				class="tab"
				class:active={activeTab === 'accessibility'}
				onclick={() => (activeTab = 'accessibility')}
			>
				<span class="tab-icon">♿</span>
				Accessibility
			</button>
		</div>

		<!-- Tab Content -->
		<div class="tab-content">
			{#if activeTab === 'tts'}
				<!-- TTS Settings -->
				<div class="settings-section">
					<h3>Text-to-Speech Configuration</h3>

					<!-- Provider Selection -->
					<div class="setting-group">
						<label class="setting-label">TTS Provider</label>
						<div class="radio-group">
							<label class="radio-label">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="polly"
									name="provider"
								/>
								<span class="radio-content">
									<strong>AWS Polly</strong>
									<span class="radio-description"
										>High-quality neural voices with advanced features</span
									>
								</span>
							</label>
							<label class="radio-label">
								<input
									type="radio"
									bind:group={localTtsConfig.provider}
									value="browser"
									name="provider"
								/>
								<span class="radio-content">
									<strong>Browser TTS</strong>
									<span class="radio-description">Free, uses system voices (Web Speech API)</span>
								</span>
							</label>
						</div>
					</div>

					{#if localTtsConfig.provider === 'polly'}
						<!-- Polly Settings -->
						<div class="setting-group">
							<label for="polly-voice" class="setting-label">Voice</label>
							<select id="polly-voice" bind:value={localTtsConfig.voice} class="select-input">
								{#each pollyVoices as voice}
									<option value={voice.name}>{voice.name} ({voice.gender})</option>
								{/each}
							</select>
						</div>

						<div class="setting-group">
							<label for="polly-engine" class="setting-label">Engine</label>
							<select
								id="polly-engine"
								bind:value={localTtsConfig.pollyEngine}
								class="select-input"
							>
								<option value="neural">Neural (Best Quality)</option>
								<option value="standard">Standard</option>
							</select>
						</div>

						<div class="setting-group">
							<label for="sample-rate" class="setting-label">Sample Rate</label>
							<select
								id="sample-rate"
								bind:value={localTtsConfig.pollySampleRate}
								class="select-input"
							>
								<option value={24000}>24kHz (Recommended)</option>
								<option value={22050}>22.05kHz</option>
								<option value={16000}>16kHz</option>
								<option value={8000}>8kHz</option>
							</select>
						</div>
					{:else}
						<!-- Browser TTS Settings -->
						<div class="setting-group">
							<label for="browser-voice" class="setting-label">
								Voice {voicesLoaded ? `(${englishVoices.length} available)` : '(Loading...)'}
							</label>
							<select id="browser-voice" bind:value={localTtsConfig.voice} class="select-input">
								<option value="">Default</option>
								{#each englishVoices as voice}
									<option value={voice.name}>{voice.name} ({voice.lang})</option>
								{/each}
							</select>
						</div>
					{/if}

					<!-- Common Settings -->
					<div class="setting-group">
						<label for="rate" class="setting-label">
							Speech Rate: {localTtsConfig.rate.toFixed(1)}x
						</label>
						<input
							id="rate"
							type="range"
							bind:value={localTtsConfig.rate}
							min="0.5"
							max="2.0"
							step="0.1"
							class="slider-input"
						/>
						<div class="slider-labels">
							<span>Slower</span>
							<span>Normal</span>
							<span>Faster</span>
						</div>
					</div>

					<div class="setting-group">
						<label for="pitch" class="setting-label">
							Pitch: {localTtsConfig.pitch.toFixed(1)}x
						</label>
						<input
							id="pitch"
							type="range"
							bind:value={localTtsConfig.pitch}
							min="0.5"
							max="2.0"
							step="0.1"
							class="slider-input"
						/>
						<div class="slider-labels">
							<span>Lower</span>
							<span>Normal</span>
							<span>Higher</span>
						</div>
					</div>

					<!-- Preview -->
					{#if ttsService}
						<div class="preview-section">
							<button
								class="btn-secondary"
								onclick={() =>
									ttsService?.speak(
										'This is a preview of the selected voice with current settings.'
									)}
							>
								🔊 Preview Voice
							</button>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'highlight'}
				<!-- Highlighting Settings -->
				<div class="settings-section">
					<h3>Text Highlighting Configuration</h3>

					<div class="setting-group">
						<label class="checkbox-label">
							<input type="checkbox" bind:checked={localHighlightConfig.enabled} />
							<span>Enable text highlighting</span>
						</label>
						<p class="setting-description">
							Allow students to highlight text in passages and questions
						</p>
					</div>

					{#if localHighlightConfig.enabled}
						<div class="setting-group">
							<label class="setting-label">Highlight Color</label>
							<div class="color-presets">
								{#each highlightPresets as preset}
									<button
										class="color-preset"
										class:active={localHighlightConfig.color === preset.color}
										style="background-color: {preset.color}"
										onclick={() => (localHighlightConfig.color = preset.color)}
										title={preset.name}
									>
										{#if localHighlightConfig.color === preset.color}
											<span class="check-icon">✓</span>
										{/if}
									</button>
								{/each}
								<input
									type="color"
									bind:value={localHighlightConfig.color}
									class="color-picker"
									title="Custom color"
								/>
							</div>
						</div>

						<div class="setting-group">
							<label for="opacity" class="setting-label">
								Opacity: {Math.round(localHighlightConfig.opacity * 100)}%
							</label>
							<input
								id="opacity"
								type="range"
								bind:value={localHighlightConfig.opacity}
								min="0.1"
								max="1.0"
								step="0.1"
								class="slider-input"
							/>
							<div class="slider-labels">
								<span>Subtle</span>
								<span>Medium</span>
								<span>Bold</span>
							</div>
						</div>

						<!-- Preview -->
						<div class="preview-section">
							<p class="highlight-preview">
								This is a preview of how highlighted text will appear with your current settings.
								<span
									class="highlighted-text"
									style="background-color: {localHighlightConfig.color}; opacity: {localHighlightConfig.opacity}"
								>
									Sample highlighted text
								</span>
								in the assessment.
							</p>
						</div>
					{/if}
				</div>
			{:else if activeTab === 'tools'}
				<!-- Tools Settings -->
				<div class="settings-section">
					<h3>Assessment Tools Configuration</h3>

					<div class="info-box">
						<p>
							<strong>Note:</strong> Tool availability is currently determined by the assessment
							configuration. This section will allow customization of tool behavior in future updates.
						</p>
					</div>

					<div class="setting-group">
						<h4>Available Tools</h4>
						<ul class="tools-list">
							<li>
								<span class="tool-icon">🧮</span>
								<strong>Calculator</strong> - Basic and scientific calculator modes
							</li>
							<li>
								<span class="tool-icon">📏</span>
								<strong>Ruler</strong> - Digital measurement tool
							</li>
							<li>
								<span class="tool-icon">📐</span>
								<strong>Protractor</strong> - Angle measurement tool
							</li>
							<li>
								<span class="tool-icon">📊</span>
								<strong>Graph</strong> - Graphing and plotting tool
							</li>
							<li>
								<span class="tool-icon">🎨</span>
								<strong>Color Scheme</strong> - Contrast and display options
							</li>
						</ul>
					</div>

					<div class="setting-group coming-soon">
						<h4>Coming Soon</h4>
						<ul class="feature-list">
							<li>Custom tool shortcuts</li>
							<li>Tool position preferences</li>
							<li>Default tool states</li>
							<li>Tool persistence across sessions</li>
						</ul>
					</div>
				</div>
			{:else if activeTab === 'accessibility'}
				<!-- Accessibility Settings -->
				<div class="settings-section">
					<h3>Accessibility Features</h3>

					<div class="info-box">
						<p>
							<strong>Note:</strong> Additional accessibility features are planned for future
							releases, including keyboard navigation enhancements, screen reader optimizations, and
							customizable display preferences.
						</p>
					</div>

					<div class="setting-group">
						<h4>Current Features</h4>
						<ul class="features-list">
							<li>✓ ARIA labels and landmarks</li>
							<li>✓ Keyboard navigation support</li>
							<li>✓ Focus management</li>
							<li>✓ Text-to-speech integration</li>
							<li>✓ SSML catalog support</li>
							<li>✓ Tool coordination (z-index management)</li>
						</ul>
					</div>

					<div class="setting-group coming-soon">
						<h4>Planned Enhancements</h4>
						<ul class="feature-list">
							<li>High contrast mode</li>
							<li>Font size adjustment</li>
							<li>Line spacing customization</li>
							<li>Color blind friendly palettes</li>
							<li>Extended keyboard shortcuts</li>
							<li>Screen reader optimizations</li>
						</ul>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer Actions -->
		<div class="modal-footer">
			<button class="btn-secondary" onclick={handleReset}>Reset to Defaults</button>
			<div class="footer-right">
				<button class="btn-secondary" onclick={onClose}>Cancel</button>
				<button class="btn-primary" onclick={handleApply}>Apply Settings</button>
			</div>
		</div>
	</div>
</div>

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		max-width: 800px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.close-button:hover {
		background: #f3f4f6;
		color: #1f2937;
	}

	/* Tabs */
	.tabs {
		display: flex;
		border-bottom: 2px solid #e5e7eb;
		background: #f9fafb;
		padding: 0 1rem;
		overflow-x: auto;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		background: none;
		border: none;
		border-bottom: 3px solid transparent;
		color: #6b7280;
		font-size: 0.95rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
		margin-bottom: -2px;
	}

	.tab:hover {
		color: #1f2937;
		background: rgba(59, 130, 246, 0.05);
	}

	.tab.active {
		color: #2563eb;
		border-bottom-color: #2563eb;
		background: white;
	}

	.tab-icon {
		font-size: 1.2rem;
	}

	/* Tab Content */
	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.settings-section {
		max-width: 600px;
		margin: 0 auto;
	}

	.settings-section h3 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.settings-section h4 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	/* Setting Groups */
	.setting-group {
		margin-bottom: 1.5rem;
	}

	.setting-label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
		font-size: 0.95rem;
	}

	.setting-description {
		margin: 0.5rem 0 0 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Radio Groups */
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.radio-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.radio-label:hover {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.02);
	}

	.radio-label input[type='radio'] {
		margin-top: 0.25rem;
		cursor: pointer;
	}

	.radio-label input[type='radio']:checked + .radio-content {
		color: #1f2937;
	}

	.radio-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.radio-description {
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Checkbox */
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-weight: 500;
		color: #374151;
	}

	.checkbox-label input[type='checkbox'] {
		width: 18px;
		height: 18px;
		cursor: pointer;
	}

	/* Inputs */
	.select-input {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.95rem;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.select-input:hover {
		border-color: #9ca3af;
	}

	.select-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.slider-input {
		width: 100%;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: #e5e7eb;
		border-radius: 3px;
		outline: none;
	}

	.slider-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		background: #3b82f6;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider-input::-webkit-slider-thumb:hover {
		background: #2563eb;
		transform: scale(1.1);
	}

	.slider-input::-moz-range-thumb {
		width: 18px;
		height: 18px;
		background: #3b82f6;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: all 0.2s;
	}

	.slider-input::-moz-range-thumb:hover {
		background: #2563eb;
		transform: scale(1.1);
	}

	.slider-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #6b7280;
	}

	/* Color Presets */
	.color-presets {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.color-preset {
		width: 48px;
		height: 48px;
		border: 3px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-preset:hover {
		transform: scale(1.1);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.color-preset.active {
		border-color: #1f2937;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.check-icon {
		color: white;
		font-size: 1.5rem;
		font-weight: bold;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}

	.color-picker {
		width: 48px;
		height: 48px;
		border: 2px solid #d1d5db;
		border-radius: 8px;
		cursor: pointer;
	}

	/* Preview Sections */
	.preview-section {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.highlight-preview {
		margin: 0;
		line-height: 1.6;
		color: #374151;
	}

	.highlighted-text {
		padding: 0 2px;
		border-radius: 2px;
	}

	/* Info Box */
	.info-box {
		padding: 1rem;
		background: #eff6ff;
		border-left: 4px solid #3b82f6;
		border-radius: 6px;
		margin-bottom: 1.5rem;
	}

	.info-box p {
		margin: 0;
		color: #1e40af;
		font-size: 0.9rem;
	}

	/* Lists */
	.tools-list,
	.features-list,
	.feature-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.tools-list li,
	.features-list li {
		padding: 0.75rem;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.tools-list li:last-child,
	.features-list li:last-child {
		border-bottom: none;
	}

	.tool-icon {
		font-size: 1.5rem;
	}

	.feature-list {
		padding-left: 1.5rem;
	}

	.feature-list li {
		padding: 0.5rem 0;
		color: #6b7280;
	}

	.coming-soon {
		opacity: 0.7;
	}

	/* Footer */
	.modal-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.footer-right {
		display: flex;
		gap: 0.75rem;
	}

	/* Buttons */
	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 1.25rem;
		border-radius: 6px;
		font-weight: 500;
		font-size: 0.95rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
	}

	.btn-primary {
		background: #2563eb;
		color: white;
	}

	.btn-primary:hover {
		background: #1d4ed8;
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.modal-content {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.tabs {
			overflow-x: auto;
		}

		.tab {
			padding: 0.75rem 1rem;
			font-size: 0.875rem;
		}

		.tab-icon {
			font-size: 1rem;
		}

		.modal-footer {
			flex-direction: column;
			gap: 0.75rem;
		}

		.footer-right {
			width: 100%;
		}

		.btn-primary,
		.btn-secondary {
			flex: 1;
		}
	}
</style>
