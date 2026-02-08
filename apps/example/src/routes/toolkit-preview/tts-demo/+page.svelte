<script lang="ts">

	import { BrowserTTSProvider, TTSService } from '@pie-players/pie-assessment-toolkit';
	import { ServerTTSProvider, type ServerTTSProviderConfig } from '@pie-players/tts-client-server';
import { onMount } from 'svelte';

	let ttsService: TTSService;
	let contentElement: HTMLElement;
	let status = 'Initializing...';
	let provider: 'browser' | 'server' = 'server';
	let isPlaying = false;
	let isPaused = false;
	let currentProvider = '';

	const sampleText = `Welcome to the PIE Players TTS demonstration. This example shows millisecond-precise word highlighting synchronized with speech using AWS Polly speech marks. Notice how each word is highlighted exactly as it's spoken. The server-side architecture ensures consistent quality across all browsers and devices.`;

	onMount(async () => {
		await initializeTTS(provider);
	});

	async function initializeTTS(providerType: 'browser' | 'server') {
		try {
			status = `Initializing ${providerType} TTS...`;

			ttsService = new TTSService();

			if (providerType === 'server') {
				// Try server-side TTS first (AWS Polly with speech marks)
				try {
					const serverProvider = new ServerTTSProvider();
					await ttsService.initialize(serverProvider, {
						apiEndpoint: '/api/tts',
						provider: 'polly',
						voice: 'Joanna',
						language: 'en-US',
						rate: 1.0,
					} as Partial<ServerTTSProviderConfig>);
					currentProvider = 'AWS Polly (Server-side) with Speech Marks';
					status = '✅ Server TTS ready (AWS Polly with speech marks)';
				} catch (error) {
					console.error('Server TTS failed:', error);
					const errorMessage = error instanceof Error ? error.message : String(error);
					status = `❌ Server TTS failed: ${errorMessage}. Falling back to browser TTS.`;
					// Fallback to browser TTS
					const browserProvider = new BrowserTTSProvider();
					await ttsService.initialize(browserProvider);
					currentProvider = 'Browser Web Speech API (Fallback)';
					provider = 'browser';
				}
			} else {
				// Use browser TTS directly
				const browserProvider = new BrowserTTSProvider();
				await ttsService.initialize(browserProvider);
				currentProvider = 'Browser Web Speech API';
				status = '✅ Browser TTS ready';
			}
		} catch (error) {
			console.error('TTS initialization failed:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			status = `❌ Error: ${errorMessage}`;
		}
	}

	async function handleSpeak() {
		if (!ttsService || !contentElement) {
			status = '❌ TTS not initialized or content element missing';
			return;
		}

		try {
			isPlaying = true;
			isPaused = false;
			status = '🔊 Speaking...';

			await ttsService.speak(sampleText, {
				contentElement,
				language: 'en-US',
			});

			isPlaying = false;
			status = '✅ Finished speaking';
		} catch (error) {
			console.error('Speak failed:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			status = `❌ Error: ${errorMessage}`;
			isPlaying = false;
		}
	}

	function handlePause() {
		if (ttsService) {
			ttsService.pause();
			isPaused = true;
			status = '⏸️ Paused';
		}
	}

	function handleResume() {
		if (ttsService) {
			ttsService.resume();
			isPaused = false;
			status = '🔊 Speaking...';
		}
	}

	function handleStop() {
		if (ttsService) {
			ttsService.stop();
			isPlaying = false;
			isPaused = false;
			status = '⏹️ Stopped';
		}
	}

	async function handleProviderSwitch() {
		handleStop();
		await initializeTTS(provider);
	}
</script>

<div class="max-w-4xl mx-auto p-8">
	<h1 class="text-3xl font-bold mb-6">Text-to-Speech Demo</h1>

	<div class="card bg-base-200 shadow-xl mb-6">
		<div class="card-body">
			<h2 class="card-title">Provider Settings</h2>

			<div class="form-control">
				<label class="label cursor-pointer">
					<span class="label-text">Provider:</span>
					<select
						bind:value={provider}
						on:change={handleProviderSwitch}
						class="select select-bordered"
						disabled={isPlaying}
					>
						<option value="server">Server TTS (AWS Polly + Speech Marks)</option>
						<option value="browser">Browser TTS (Web Speech API)</option>
					</select>
				</label>
			</div>

			<div class="alert alert-info">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					class="stroke-current shrink-0 w-6 h-6"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					></path>
				</svg>
				<div>
					<div class="font-bold">Current Provider: {currentProvider}</div>
					<div class="text-sm">{status}</div>
				</div>
			</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl mb-6">
		<div class="card-body">
			<h2 class="card-title">Content</h2>

			<div
				bind:this={contentElement}
				class="prose bg-base-200 p-4 rounded-lg"
			>
				<p>{sampleText}</p>
			</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Controls</h2>

			<div class="flex gap-2 flex-wrap">
				<button
					class="btn btn-primary"
					on:click={handleSpeak}
					disabled={isPlaying || !ttsService}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
							clip-rule="evenodd"
						/>
					</svg>
					Speak
				</button>

				<button
					class="btn btn-warning"
					on:click={handlePause}
					disabled={!isPlaying || isPaused}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/>
					</svg>
					Pause
				</button>

				<button
					class="btn btn-info"
					on:click={handleResume}
					disabled={!isPaused}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
							clip-rule="evenodd"
						/>
					</svg>
					Resume
				</button>

				<button
					class="btn btn-error"
					on:click={handleStop}
					disabled={!isPlaying && !isPaused}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-5 w-5"
						viewBox="0 0 20 20"
						fill="currentColor"
					>
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
							clip-rule="evenodd"
						/>
					</svg>
					Stop
				</button>
			</div>
		</div>
	</div>

	<div class="card bg-base-100 shadow-xl mt-6">
		<div class="card-body">
			<h2 class="card-title">Provider Comparison</h2>

			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Feature</th>
							<th>Server TTS (Polly)</th>
							<th>Browser TTS</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Word Highlighting</td>
							<td class="text-success">✅ Millisecond-precise</td>
							<td class="text-warning">⚠️ Unreliable</td>
						</tr>
						<tr>
							<td>Voice Quality</td>
							<td class="text-success">⭐⭐⭐⭐⭐ Neural</td>
							<td class="text-info">⭐⭐⭐ Synthetic</td>
						</tr>
						<tr>
							<td>Consistency</td>
							<td class="text-success">✅ Same everywhere</td>
							<td class="text-warning">⚠️ Varies by OS</td>
						</tr>
						<tr>
							<td>Offline</td>
							<td class="text-error">❌ Requires internet</td>
							<td class="text-success">✅ Works offline</td>
						</tr>
						<tr>
							<td>Cost</td>
							<td class="text-warning">💰 $16/1M chars</td>
							<td class="text-success">✅ Free</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div class="alert alert-warning mt-4">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="stroke-current shrink-0 h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
				<div>
					<strong>Setup Required:</strong> Server TTS requires AWS credentials in <code>.env</code>.
					See <a href="/docs/aws-polly-setup-guide.md" class="link">AWS Polly Setup Guide</a>.
				</div>
			</div>
		</div>
	</div>
</div>
