/**
 * ServerTTSProvider - Client-side TTS provider that calls server API
 *
 * Provides high-quality TTS by calling a server-side API that uses
 * providers like AWS Polly, Google Cloud TTS, etc.
 * Returns audio with precise word-level timing (speech marks).
 */

import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

/**
 * Configuration for ServerTTSProvider
 */
export interface ServerTTSProviderConfig extends TTSConfig {
	/** API endpoint base URL (e.g., '/api/tts' or 'https://api.example.com/tts') */
	apiEndpoint: string;

	/** Provider to use on server ('polly', 'google', 'elevenlabs', etc.) */
	provider?: string;

	/** Authentication token or API key */
	authToken?: string;

	/** Custom headers for API requests */
	headers?: Record<string, string>;

	/** Language code */
	language?: string;

	/** Volume level 0-1 */
	volume?: number;

	/**
	 * Validate API endpoint availability during initialization (slower but safer)
	 *
	 * @extension Performance vs safety tradeoff
	 * @default false (fast initialization, fail on first synthesis if unavailable)
	 * @note When true, adds 100-500ms to initialization time
	 */
	validateEndpoint?: boolean;
}

/**
 * Word timing from speech marks
 */
interface WordTiming {
	time: number; // Milliseconds from audio start
	wordIndex: number;
	charIndex: number; // Character position in text
	length: number; // Word length in characters
}

/**
 * Server API response for synthesis
 */
interface SynthesizeAPIResponse {
	audio: string; // Base64 encoded audio
	contentType: string;
	speechMarks: Array<{
		time: number;
		type: string;
		start: number;
		end: number;
		value: string;
	}>;
	metadata: {
		providerId: string;
		voice: string;
		duration: number;
		charCount: number;
		cached: boolean;
	};
}

/**
 * Provider implementation that handles audio playback
 */
class ServerTTSProviderImpl implements ITTSProviderImplementation {
	private config: ServerTTSProviderConfig;
	private currentAudio: HTMLAudioElement | null = null;
	private pausedState = false;
	private wordTimings: WordTiming[] = [];
	private highlightInterval: number | null = null;

	public onWordBoundary?: (
		word: string,
		position: number,
		length?: number,
	) => void;

	constructor(config: ServerTTSProviderConfig) {
		this.config = config;
	}

	async speak(text: string): Promise<void> {
		// Stop any current playback
		this.stop();

		// Call server API to synthesize speech
		const { audioUrl, wordTimings } = await this.synthesizeSpeech(text);

		// Adjust word timing for playback rate
		// Speech marks are at 1.0x speed, so we need to scale them
		const playbackRate = this.config.rate || 1.0;
		this.wordTimings = wordTimings.map((timing) => ({
			...timing,
			time: timing.time / playbackRate,
		}));

		return new Promise((resolve, reject) => {
			// Create audio element
			const audio = new Audio(audioUrl);
			this.currentAudio = audio;

			// Apply rate from config
			if (this.config.rate) {
				audio.playbackRate = Math.max(0.25, Math.min(4.0, this.config.rate));
			}

			// Apply volume from config
			if (this.config.volume !== undefined) {
				audio.volume = Math.max(0, Math.min(1, this.config.volume));
			}

			// Setup event handlers
			audio.onplay = () => {
				this.pausedState = false;

				// Start word highlighting
				if (this.onWordBoundary && this.wordTimings.length > 0) {
					this.startWordHighlighting();
				}
			};

			audio.onended = () => {
				this.stopWordHighlighting();
				URL.revokeObjectURL(audioUrl);
				this.currentAudio = null;
				this.wordTimings = [];
				resolve();
			};

			audio.onerror = () => {
				this.stopWordHighlighting();
				URL.revokeObjectURL(audioUrl);
				this.currentAudio = null;
				this.wordTimings = [];
				reject(new Error("Failed to play audio from server"));
			};

			audio.onpause = () => {
				this.stopWordHighlighting();
				this.pausedState = true;
			};

			// Start playback
			audio.play().catch(reject);
		});
	}

	/**
	 * Call server API to synthesize speech
	 */
	private async synthesizeSpeech(
		text: string,
	): Promise<{ audioUrl: string; wordTimings: WordTiming[] }> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...this.config.headers,
		};

		// Add authentication if provided
		if (this.config.authToken) {
			headers["Authorization"] = `Bearer ${this.config.authToken}`;
		}

		const requestBody = {
			text,
			provider: this.config.provider || "polly",
			voice: this.config.voice,
			language: this.config.language,
			rate: this.config.rate,
			includeSpeechMarks: true,
		};

		const response = await fetch(`${this.config.apiEndpoint}/synthesize`, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(
				errorData.error?.message || `Server returned ${response.status}`,
			);
		}

		const data: SynthesizeAPIResponse = await response.json();

		// Convert base64 audio to blob URL
		const audioBlob = this.base64ToBlob(data.audio, data.contentType);
		const audioUrl = URL.createObjectURL(audioBlob);

		// Convert speech marks to word timings
		const wordTimings = this.parseSpeechMarks(data.speechMarks);

		return { audioUrl, wordTimings };
	}

	/**
	 * Convert base64 to Blob
	 */
	private base64ToBlob(base64: string, contentType: string): Blob {
		const byteCharacters = atob(base64);
		const byteNumbers = new Array(byteCharacters.length);

		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);
		return new Blob([byteArray], { type: contentType });
	}

	/**
	 * Parse speech marks into word timings
	 */
	private parseSpeechMarks(
		marks: SynthesizeAPIResponse["speechMarks"],
	): WordTiming[] {
		return marks
			.filter((mark) => mark.type === "word")
			.map((mark, index) => ({
				time: mark.time,
				wordIndex: index,
				charIndex: mark.start,
				length: mark.end - mark.start,
			}));
	}

	/**
	 * Start word highlighting synchronized with audio playback
	 */
	private startWordHighlighting(): void {
		this.stopWordHighlighting();

		if (
			!this.currentAudio ||
			!this.onWordBoundary ||
			this.wordTimings.length === 0
		) {
			console.log("[ServerTTSProvider] Cannot start highlighting:", {
				hasAudio: !!this.currentAudio,
				hasCallback: !!this.onWordBoundary,
				wordTimingsCount: this.wordTimings.length,
			});
			return;
		}

		console.log(
			"[ServerTTSProvider] Starting word highlighting with",
			this.wordTimings.length,
			"word timings",
		);
		console.log(
			"[ServerTTSProvider] Playback rate:",
			this.currentAudio.playbackRate,
		);
		console.log(
			"[ServerTTSProvider] First 3 timings:",
			this.wordTimings.slice(0, 3),
		);

		let lastWordIndex = -1;

		// Poll every 50ms to check current playback time
		this.highlightInterval = window.setInterval(() => {
			if (!this.currentAudio) {
				this.stopWordHighlighting();
				return;
			}

			// Get current playback time in milliseconds
			const currentTime = this.currentAudio.currentTime * 1000;

			// Find words that should be highlighted at current time
			for (let i = 0; i < this.wordTimings.length; i++) {
				const timing = this.wordTimings[i];

				if (currentTime >= timing.time && i > lastWordIndex) {
					// Fire word boundary callback
					if (this.onWordBoundary) {
						console.log(
							"[ServerTTSProvider] Highlighting word at charIndex:",
							timing.charIndex,
							"length:",
							timing.length,
							"time:",
							timing.time,
							"currentTime:",
							currentTime,
						);
						// Pass the length as the "word" parameter so TTSService can use it
						this.onWordBoundary("", timing.charIndex, timing.length);
					}
					lastWordIndex = i;
					break;
				}
			}
		}, 50); // 50ms polling = 20 times per second
	}

	/**
	 * Stop word highlighting
	 */
	private stopWordHighlighting(): void {
		if (this.highlightInterval !== null) {
			clearInterval(this.highlightInterval);
			this.highlightInterval = null;
		}
	}

	pause(): void {
		if (this.currentAudio && !this.pausedState) {
			this.currentAudio.pause();
			this.stopWordHighlighting();
			this.pausedState = true;
		}
	}

	resume(): void {
		if (this.currentAudio && this.pausedState) {
			this.currentAudio.play();
			this.pausedState = false;

			// Resume word highlighting
			if (this.onWordBoundary && this.wordTimings.length > 0) {
				this.startWordHighlighting();
			}
		}
	}

	stop(): void {
		this.stopWordHighlighting();

		if (this.currentAudio) {
			this.currentAudio.pause();
			if (this.currentAudio.src) {
				URL.revokeObjectURL(this.currentAudio.src);
			}
			this.currentAudio.src = "";
			this.currentAudio = null;
		}

		this.pausedState = false;
		this.wordTimings = [];
	}

	isPlaying(): boolean {
		return this.currentAudio !== null && !this.pausedState;
	}

	isPaused(): boolean {
		return this.pausedState;
	}
}

/**
 * Server TTS Provider
 *
 * Client-side provider that calls a server API for TTS synthesis.
 * The server handles provider selection (Polly, Google, etc.) and credential management.
 */
export class ServerTTSProvider implements ITTSProvider {
	readonly providerId = "server-tts";
	readonly providerName = "Server TTS";
	readonly version = "1.0.0";

	private config: ServerTTSProviderConfig | null = null;

	/**
	 * Initialize the server TTS provider.
	 *
	 * This is designed to be fast by default (no API calls).
	 * Set validateEndpoint: true in config to test API availability during initialization.
	 *
	 * @performance Default: <10ms, With validation: 100-500ms
	 */
	async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
		const serverConfig = config as ServerTTSProviderConfig;

		if (!serverConfig.apiEndpoint) {
			throw new Error("apiEndpoint is required for ServerTTSProvider");
		}

		this.config = serverConfig;

		// Only test API availability if explicitly requested (slower but safer)
		if (serverConfig.validateEndpoint) {
			const available = await this.testAPIAvailability();
			if (!available) {
				throw new Error(
					`Server TTS API not available at ${serverConfig.apiEndpoint}`,
				);
			}
		}

		return new ServerTTSProviderImpl(serverConfig);
	}

	/**
	 * Test if API endpoint is available (with timeout).
	 *
	 * @performance 100-500ms depending on network
	 */
	private async testAPIAvailability(): Promise<boolean> {
		if (!this.config) return false;

		try {
			const headers: Record<string, string> = { ...this.config.headers };

			if (this.config.authToken) {
				headers["Authorization"] = `Bearer ${this.config.authToken}`;
			}

			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

			try {
				// Try to fetch voices to test API
				const response = await fetch(`${this.config.apiEndpoint}/voices`, {
					headers,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);
				return response.ok;
			} catch (fetchError) {
				clearTimeout(timeoutId);
				// If aborted due to timeout or network error, consider API unavailable
				return false;
			}
		} catch {
			return false;
		}
	}

	supportsFeature(feature: TTSFeature): boolean {
		switch (feature) {
			case "pause":
			case "resume":
			case "wordBoundary":
			case "voiceSelection":
			case "rateControl":
				return true;
			case "pitchControl":
				// Depends on server provider, assume no for safety
				return false;
			default:
				return false;
		}
	}

	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true, // ✅ Via speech marks from server
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: false, // Depends on server provider
			maxTextLength: 3000, // Conservative estimate
		};
	}

	destroy(): void {
		this.config = null;
	}
}
