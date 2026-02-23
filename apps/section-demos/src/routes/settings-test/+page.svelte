<script lang="ts">

	import { TTSService, BrowserTTSProvider } from '@pie-players/pie-assessment-toolkit';
	import { ServerTTSProvider } from '@pie-players/tts-client-server';
import { onMount } from 'svelte';
	import AssessmentToolkitSettings from '$lib/components/AssessmentToolkitSettings.svelte';

	let showSettings = $state(true);
	let ttsService = $state<TTSService | undefined>(undefined);

	type TTSConfigType = {
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

	let ttsConfig = $state<TTSConfigType>({
		provider: 'browser',
		voice: '',
		rate: 1.0,
		pitch: 1.0,
		pollyEngine: 'neural',
		pollySampleRate: 24000,
		highlightStyle: {
			color: '#ffeb3b',
			opacity: 0.4
		}
	});

	onMount(async () => {
		// Initialize TTS Service
		ttsService = new TTSService();
		const provider = ttsConfig.provider === 'browser'
			? new BrowserTTSProvider()
			: new ServerTTSProvider();
		await ttsService.initialize(provider, {
			voice: ttsConfig.voice,
			rate: ttsConfig.rate,
			pitch: ttsConfig.pitch
		});
	});

	function handleClose() {
		showSettings = false;
		console.log('[Settings Test] Settings closed without applying');
	}

	async function handleApply(settings: { tts: typeof ttsConfig; layout: { toolbarPosition: 'top' | 'right' | 'bottom' | 'left' } }) {
		console.log('[Settings Test] Applying settings:', settings);

		// Re-initialize TTS if provider or voice changed
		if (
			settings.tts.provider !== ttsConfig.provider ||
			settings.tts.voice !== ttsConfig.voice
		) {
			console.log('[Settings Test] Re-initializing TTS with new provider/voice');
			if (ttsService) {
				let provider;
				if (settings.tts.provider === 'browser') {
					provider = new BrowserTTSProvider();
				} else {
					// Both 'polly' and 'google' use ServerTTSProvider
					provider = new ServerTTSProvider();
				}
				await ttsService.initialize(provider, {
					voice: settings.tts.voice,
					rate: settings.tts.rate,
					pitch: settings.tts.pitch
				});
			}
		}

		// Update configs
		ttsConfig = settings.tts;

		// Save to localStorage
		localStorage.setItem('toolkit-settings-test', JSON.stringify(settings));

		// Close modal
		showSettings = false;
		console.log('[Settings Test] Settings applied successfully');
	}

	function reopenSettings() {
		showSettings = true;
	}
</script>

<div class="test-page">
	<div class="test-header">
		<h1>Assessment Toolkit Settings Test</h1>
		<p>This page tests the unified settings component in isolation.</p>
	</div>

	<div class="test-controls">
		<button class="btn" onclick={reopenSettings}>
			⚙️ Open Settings
		</button>

		<div class="current-config">
			<h3>Current Configuration</h3>
			<div class="config-section">
				<h4>TTS Settings</h4>
				<ul>
					<li><strong>Provider:</strong> {ttsConfig.provider}</li>
					<li><strong>Voice:</strong> {ttsConfig.voice}</li>
					<li><strong>Rate:</strong> {ttsConfig.rate}x</li>
					<li><strong>Pitch:</strong> {ttsConfig.pitch}x</li>
					{#if ttsConfig.provider === 'polly'}
						<li><strong>Engine:</strong> {ttsConfig.pollyEngine}</li>
						<li><strong>Sample Rate:</strong> {ttsConfig.pollySampleRate}Hz</li>
					{/if}
				</ul>
			</div>

			<div class="config-section">
				<h4>Highlighting Settings</h4>
				<ul>
					<li><strong>Mode:</strong> TTS highlight style</li>
					<li>
						<strong>Color:</strong>
						<span
							class="color-swatch"
							style="background-color: {ttsConfig.highlightStyle?.color || '#ffeb3b'}"
						></span>
						{ttsConfig.highlightStyle?.color || '#ffeb3b'}
					</li>
					<li><strong>Opacity:</strong> {Math.round((ttsConfig.highlightStyle?.opacity || 0.4) * 100)}%</li>
				</ul>
			</div>
		</div>

		<div class="test-actions">
			<h3>Test Actions</h3>
			<button
				class="btn btn-secondary"
				onclick={() => ttsService?.speak('Testing TTS with current settings.')}
			>
				🔊 Test TTS
			</button>
			<button class="btn btn-secondary" onclick={() => ttsService?.stop()}>
				⏹️ Stop TTS
			</button>

			<div class="highlight-test">
				<p>
					This is a test paragraph with
					<span
						class="highlighted"
						style="background-color: {ttsConfig.highlightStyle?.color || '#ffeb3b'}; opacity: {ttsConfig.highlightStyle?.opacity || 0.4}"
					>
						highlighted text
					</span>
					to demonstrate the current highlighting settings.
				</p>
			</div>
		</div>

		<div class="instructions">
			<h3>Testing Instructions</h3>
			<ol>
				<li>Click "Open Settings" to open the unified settings modal</li>
				<li>Switch between tabs (TTS, Highlighting, Tools, Accessibility)</li>
				<li>Change TTS settings and test with "Test TTS" button</li>
				<li>Change highlight color/opacity and observe the preview</li>
				<li>Click "Apply Settings" to save changes</li>
				<li>Verify changes are reflected in the "Current Configuration" section</li>
				<li>Click "Cancel" to test closing without applying changes</li>
				<li>Reopen settings to verify cancelled changes were not saved</li>
			</ol>
		</div>
	</div>

	{#if showSettings}
		<AssessmentToolkitSettings
			{ttsService}
			bind:ttsConfig
			onClose={handleClose}
			onApply={handleApply}
		/>
	{/if}
</div>

<style>
	.test-page {
		min-height: 100vh;
		padding: 2rem;
		background: #f3f4f6;
	}

	.test-header {
		max-width: 800px;
		margin: 0 auto 2rem;
		text-align: center;
	}

	.test-header h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0 0 0.5rem;
	}

	.test-header p {
		color: #6b7280;
		font-size: 1rem;
	}

	.test-controls {
		max-width: 800px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		background: #2563eb;
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 1rem;
	}

	.btn:hover {
		background: #1d4ed8;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border: 2px solid #d1d5db;
	}

	.btn-secondary:hover {
		background: #f9fafb;
		border-color: #9ca3af;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.current-config,
	.test-actions,
	.instructions {
		background: white;
		padding: 1.5rem;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.current-config h3,
	.test-actions h3,
	.instructions h3 {
		margin: 0 0 1rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.config-section {
		margin-bottom: 1.5rem;
	}

	.config-section:last-child {
		margin-bottom: 0;
	}

	.config-section h4 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.config-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.config-section li {
		padding: 0.5rem 0;
		color: #6b7280;
		border-bottom: 1px solid #f3f4f6;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.config-section li:last-child {
		border-bottom: none;
	}

	.color-swatch {
		display: inline-block;
		width: 24px;
		height: 24px;
		border: 2px solid #d1d5db;
		border-radius: 4px;
	}

	.test-actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.highlight-test {
		margin-top: 1rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.highlight-test p {
		margin: 0;
		line-height: 1.6;
		color: #374151;
	}

	.highlighted {
		padding: 0 2px;
		border-radius: 2px;
	}

	.instructions ol {
		padding-left: 1.5rem;
		margin: 0;
	}

	.instructions li {
		padding: 0.5rem 0;
		color: #6b7280;
	}
</style>
