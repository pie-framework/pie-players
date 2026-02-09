/**
 * Google Cloud Text-to-Speech server-side TTS provider
 * @module @pie-players/tts-server-google
 */

import { v1beta1, protos } from "@google-cloud/text-to-speech";

import {
	BaseTTSProvider,
	type GetVoicesOptions,
	type ServerProviderCapabilities,
	type SpeechMark,
	type SynthesizeRequest,
	type SynthesizeResponse,
	TTSError,
	TTSErrorCode,
	type TTSServerConfig,
	type Voice,
} from "@pie-players/tts-server-core";

/**
 * Google Cloud Text-to-Speech provider configuration.
 *
 * This extends the base TTSServerConfig with Google Cloud-specific settings.
 */
export interface GoogleCloudTTSConfig extends TTSServerConfig {
	/**
	 * Google Cloud project ID (required)
	 *
	 * @example 'my-project-123456'
	 * @required
	 */
	projectId: string;

	/**
	 * Authentication credentials
	 *
	 * Supports multiple authentication methods:
	 * - Service account JSON file path (recommended for production)
	 * - Service account key object (for containers/serverless)
	 * - API key (for simple applications)
	 * - Omit to use Application Default Credentials (ADC) for local development
	 *
	 * @example '/path/to/service-account.json'
	 * @example { client_email: '...', private_key: '...' }
	 * @example { apiKey: 'AIza...' }
	 * @see https://cloud.google.com/docs/authentication
	 */
	credentials?:
		| string // Path to service account JSON file
		| {
				// Service account key object
				client_email: string;
				private_key: string;
				project_id?: string;
		  }
		| {
				// API key
				apiKey: string;
		  };

	/**
	 * Voice type: 'wavenet' (neural), 'standard', or 'studio' (premium)
	 *
	 * @default 'wavenet'
	 * @note WaveNet: $16/1M chars, Standard: $4/1M chars, Studio: $16/1M chars
	 */
	voiceType?: "wavenet" | "standard" | "studio";

	/**
	 * Default voice name if not specified in synthesis requests
	 *
	 * @default 'en-US-Wavenet-A'
	 * @example 'en-US-Wavenet-A', 'en-GB-Standard-B', 'es-ES-Studio-C'
	 * @see https://cloud.google.com/text-to-speech/docs/voices
	 */
	defaultVoice?: string;

	/**
	 * Audio encoding format
	 *
	 * @default 'MP3'
	 */
	audioEncoding?: "MP3" | "LINEAR16" | "OGG_OPUS";

	/**
	 * Enable detailed logging for debugging
	 *
	 * @default false
	 */
	enableLogging?: boolean;
}

/**
 * Google Cloud Text-to-Speech Server Provider
 *
 * Provides high-quality neural text-to-speech with precise word-level timing
 * through Google Cloud Text-to-Speech API.
 *
 * Features:
 * - Speech marks support via SSML mark injection (millisecond precision)
 * - WaveNet (neural), Standard, and Studio voice types
 * - 200+ voices across 50+ languages
 * - Full SSML support
 * - Single API call for audio + speech marks
 */
export class GoogleCloudTTSProvider extends BaseTTSProvider {
	readonly providerId = "google-cloud-tts";
	readonly providerName = "Google Cloud Text-to-Speech";
	readonly version = "1.0.0";

	private client!: v1beta1.TextToSpeechClient;
	private voiceType: "wavenet" | "standard" | "studio" = "wavenet";
	private defaultVoice = "en-US-Wavenet-A";
	private audioEncoding: "MP3" | "LINEAR16" | "OGG_OPUS" = "MP3";
	private enableLogging = false;

	/**
	 * Initialize the Google Cloud TTS provider.
	 *
	 * This is FAST and lightweight - only validates config and creates the client.
	 * Does NOT fetch voices or make test API calls.
	 *
	 * @param config - Google Cloud TTS configuration
	 * @performance Completes in ~10-50ms
	 */
	async initialize(config: GoogleCloudTTSConfig): Promise<void> {
		if (!config.projectId) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				"Google Cloud project ID is required",
				undefined,
				this.providerId,
			);
		}

		this.config = config;
		this.voiceType = config.voiceType || "wavenet";
		this.defaultVoice = config.defaultVoice || "en-US-Wavenet-A";
		this.audioEncoding = config.audioEncoding || "MP3";
		this.enableLogging = config.enableLogging || false;

		try {
			// Initialize Google Cloud TTS client
			const clientConfig: any = {
				projectId: config.projectId,
			};

			// Handle different credential types
			if (config.credentials) {
				if (typeof config.credentials === "string") {
					// Path to service account JSON file
					clientConfig.keyFilename = config.credentials;
				} else if ("apiKey" in config.credentials) {
					// API key authentication
					clientConfig.apiKey = config.credentials.apiKey;
				} else {
					// Service account key object
					clientConfig.credentials = config.credentials;
				}
			}
			// Else: Use Application Default Credentials (ADC)

			this.client = new v1beta1.TextToSpeechClient(clientConfig);
			this.initialized = true;

			if (this.enableLogging) {
				console.log("[GoogleCloudTTS] Initialized successfully");
			}
		} catch (error) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				`Failed to initialize Google Cloud TTS: ${error instanceof Error ? error.message : String(error)}`,
				{ error },
				this.providerId,
			);
		}
	}

	/**
	 * Synthesize speech with Google Cloud TTS
	 */
	async synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse> {
		this.ensureInitialized();

		const capabilities = this.getCapabilities();
		this.validateRequest(request, capabilities);

		const voice = request.voice || this.defaultVoice;
		const startTime = Date.now();

		try {
			// Check if speech marks are requested
			if (request.includeSpeechMarks !== false) {
				// Use SSML marks injection for precise word timing
				const result = await this.synthesizeWithSpeechMarks(request, voice);
				const duration = (Date.now() - startTime) / 1000;

				return {
					audio: result.audio,
					contentType: result.contentType,
					speechMarks: result.speechMarks,
					metadata: {
						providerId: this.providerId,
						voice,
						duration,
						charCount: request.text.length,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				};
			} else {
				// Audio only (no speech marks)
				const result = await this.synthesizeAudio(request, voice);
				const duration = (Date.now() - startTime) / 1000;

				return {
					audio: result.audio,
					contentType: result.contentType,
					speechMarks: [],
					metadata: {
						providerId: this.providerId,
						voice,
						duration,
						charCount: request.text.length,
						cached: false,
						timestamp: new Date().toISOString(),
					},
				};
			}
		} catch (error) {
			throw this.mapGoogleErrorToTTSError(error);
		}
	}

	/**
	 * Synthesize audio stream only (no speech marks)
	 */
	private async synthesizeAudio(
		request: SynthesizeRequest,
		voice: string,
	): Promise<{ audio: Buffer; contentType: string }> {
		// Detect if text contains SSML tags
		const isSsml = this.detectSSML(request.text);

		if (isSsml && this.enableLogging) {
			console.log("[GoogleCloudTTS] Detected SSML content");
		}

		// Parse voice name to extract language code
		const languageCode = voice.split("-").slice(0, 2).join("-"); // e.g., "en-US" from "en-US-Wavenet-A"

		// Map our audio encoding to Google's enum
		const audioEncodingMap = {
			MP3: "MP3" as const,
			LINEAR16: "LINEAR16" as const,
			OGG_OPUS: "OGG_OPUS" as const,
		};

		const [response] = await this.client.synthesizeSpeech({
			input: isSsml ? { ssml: request.text } : { text: request.text },
			voice: {
				languageCode,
				name: voice,
			},
			audioConfig: {
				audioEncoding: audioEncodingMap[this.audioEncoding],
				sampleRateHertz: request.sampleRate || 24000,
			},
		});

		if (!response.audioContent) {
			throw new Error("No audio content received from Google Cloud TTS");
		}

		// Convert Uint8Array to Buffer
		const audioBuffer = Buffer.from(response.audioContent);

		const contentTypeMap = {
			MP3: "audio/mpeg",
			LINEAR16: "audio/wav",
			OGG_OPUS: "audio/ogg",
		};

		return {
			audio: audioBuffer,
			contentType: contentTypeMap[this.audioEncoding],
		};
	}

	/**
	 * Synthesize with speech marks using SSML mark injection
	 */
	private async synthesizeWithSpeechMarks(
		request: SynthesizeRequest,
		voice: string,
	): Promise<{
		audio: Buffer;
		contentType: string;
		speechMarks: SpeechMark[];
	}> {
		// Check if the text is already SSML
		const isUserSSML = this.detectSSML(request.text);

		// If user provided SSML, we need to inject marks within the existing SSML
		// For simplicity in v1, we'll inject marks for plain text only
		const { ssml, wordMap } = isUserSSML
			? this.extractWordsFromSSML(request.text)
			: this.injectSSMLMarks(request.text);

		if (this.enableLogging) {
			console.log(`[GoogleCloudTTS] Injected ${wordMap.length} SSML marks`);
		}

		// Parse voice name to extract language code
		const languageCode = voice.split("-").slice(0, 2).join("-");

		// Map our audio encoding to Google's enum
		const audioEncodingMap = {
			MP3: "MP3" as const,
			LINEAR16: "LINEAR16" as const,
			OGG_OPUS: "OGG_OPUS" as const,
		};

		// Single API call with timepoint tracking enabled
		const responseArray = await this.client.synthesizeSpeech({
			input: { ssml },
			voice: {
				languageCode,
				name: voice,
			},
			audioConfig: {
				audioEncoding: audioEncodingMap[this.audioEncoding],
				sampleRateHertz: request.sampleRate || 24000,
			},
			enableTimePointing: [
				protos.google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest
					.TimepointType.SSML_MARK,
			],
		});
		const response = responseArray[0];

		if (!response.audioContent) {
			throw new Error("No audio content received from Google Cloud TTS");
		}

		// Convert Uint8Array to Buffer
		const audioBuffer = Buffer.from(response.audioContent);

		const contentTypeMap = {
			MP3: "audio/mpeg",
			LINEAR16: "audio/wav",
			OGG_OPUS: "audio/ogg",
		};

		// Extract speech marks from timepoints
		const speechMarks = this.extractSpeechMarksFromTimepoints(
			response.timepoints || [],
			wordMap,
		);

		if (this.enableLogging) {
			console.log(
				`[GoogleCloudTTS] Extracted ${speechMarks.length} speech marks`,
			);
		}

		return {
			audio: audioBuffer,
			contentType: contentTypeMap[this.audioEncoding],
			speechMarks,
		};
	}

	/**
	 * Inject SSML marks before each word in plain text
	 */
	private injectSSMLMarks(text: string): {
		ssml: string;
		wordMap: Array<{
			word: string;
			start: number;
			end: number;
			markName: string;
		}>;
	} {
		const words: Array<{
			word: string;
			start: number;
			end: number;
			markName: string;
		}> = [];
		const wordRegex = /\b[\w']+\b/g;
		let match;
		let markIndex = 0;

		while ((match = wordRegex.exec(text)) !== null) {
			const word = match[0];
			const start = match.index;
			const end = start + word.length;
			const markName = `w${markIndex++}`;

			words.push({ word, start, end, markName });
		}

		// Build SSML with marks
		let ssml = "<speak>";
		let lastEnd = 0;

		for (const { word, start, end, markName } of words) {
			// Add text before word (including whitespace and punctuation)
			ssml += this.escapeSSML(text.slice(lastEnd, start));
			// Add marked word
			ssml += `<mark name="${markName}"/>${this.escapeSSML(word)}`;
			lastEnd = end;
		}

		// Add remaining text
		ssml += this.escapeSSML(text.slice(lastEnd)) + "</speak>";

		return { ssml, wordMap: words };
	}

	/**
	 * Extract words from existing SSML (simplified version for v1)
	 */
	private extractWordsFromSSML(ssmlText: string): {
		ssml: string;
		wordMap: Array<{
			word: string;
			start: number;
			end: number;
			markName: string;
		}>;
	} {
		// For now, just strip SSML tags and inject marks
		// More sophisticated SSML parsing can be added in future versions
		const plainText = ssmlText
			.replace(/<[^>]+>/g, " ") // Remove all tags
			.replace(/\s+/g, " ") // Normalize whitespace
			.trim();

		return this.injectSSMLMarks(plainText);
	}

	/**
	 * Escape special XML characters for SSML
	 */
	private escapeSSML(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	/**
	 * Extract speech marks from Google's timepoints
	 */
	private extractSpeechMarksFromTimepoints(
		timepoints:
			| protos.google.cloud.texttospeech.v1beta1.ITimepoint[]
			| null
			| undefined,
		wordMap: Array<{
			word: string;
			start: number;
			end: number;
			markName: string;
		}>,
	): SpeechMark[] {
		if (!timepoints || timepoints.length === 0) {
			return [];
		}

		const speechMarks: SpeechMark[] = [];

		for (const timepoint of timepoints) {
			// Find corresponding word in our map
			const wordInfo = wordMap.find((w) => w.markName === timepoint.markName);

			if (
				wordInfo &&
				timepoint.timeSeconds !== undefined &&
				timepoint.timeSeconds !== null
			) {
				speechMarks.push({
					time: Math.round(timepoint.timeSeconds * 1000), // Convert to ms
					type: "word",
					start: wordInfo.start,
					end: wordInfo.end,
					value: wordInfo.word,
				});
			}
		}

		// Sort by time
		return speechMarks.sort((a, b) => a.time - b.time);
	}

	/**
	 * Detect if text contains SSML markup
	 */
	private detectSSML(text: string): boolean {
		return (
			text.includes("<speak") ||
			text.includes("<prosody") ||
			text.includes("<emphasis") ||
			text.includes("<break") ||
			text.includes("<phoneme") ||
			text.includes("<say-as") ||
			text.includes("<mark")
		);
	}

	/**
	 * Get available voices from Google Cloud TTS
	 */
	async getVoices(options?: GetVoicesOptions): Promise<Voice[]> {
		this.ensureInitialized();

		try {
			const [response] = await this.client.listVoices({
				languageCode: options?.language,
			});

			if (!response.voices) {
				return [];
			}

			return response.voices
				.map((voice) => this.mapGoogleVoiceToVoice(voice))
				.filter((voice) => {
					// Apply filters
					if (options?.gender && voice.gender !== options.gender) {
						return false;
					}
					if (options?.quality && voice.quality !== options.quality) {
						return false;
					}
					return true;
				});
		} catch (error) {
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				`Failed to get voices: ${error instanceof Error ? error.message : String(error)}`,
				{ error },
				this.providerId,
			);
		}
	}

	/**
	 * Map Google Cloud voice to unified Voice interface
	 */
	private mapGoogleVoiceToVoice(
		googleVoice: protos.google.cloud.texttospeech.v1beta1.IVoice,
	): Voice {
		const voiceName = googleVoice.name || "";

		// Determine quality based on voice type
		let quality: "standard" | "neural" | "premium" = "standard";
		if (voiceName.includes("Wavenet")) {
			quality = "neural";
		} else if (voiceName.includes("Studio")) {
			quality = "premium";
		}

		// Map SSML gender to our gender type
		const genderMap: Record<string, "male" | "female" | "neutral"> = {
			MALE: "male",
			FEMALE: "female",
			NEUTRAL: "neutral",
		};
		const gender = genderMap[googleVoice.ssmlGender || "NEUTRAL"] || "neutral";

		return {
			id: voiceName,
			name: voiceName,
			language: googleVoice.languageCodes?.[0] || "Unknown",
			languageCode: googleVoice.languageCodes?.[0] || "",
			gender,
			quality,
			supportedFeatures: {
				ssml: true,
				emotions: false, // Google doesn't have built-in emotions
				styles: false, // Google doesn't have speaking styles
			},
			providerMetadata: {
				naturalSampleRateHertz: googleVoice.naturalSampleRateHertz,
				languageCodes: googleVoice.languageCodes,
				ssmlGender: googleVoice.ssmlGender,
			},
		};
	}

	/**
	 * Get Google Cloud TTS capabilities
	 */
	getCapabilities(): ServerProviderCapabilities {
		return {
			// W3C Standard features
			standard: {
				supportsSSML: true, // ✅ Full SSML 1.1 support
				supportsPitch: true, // ✅ Via SSML <prosody pitch>
				supportsRate: true, // ✅ Via SSML <prosody rate>
				supportsVolume: false, // ❌ Not supported (handle client-side)
				supportsMultipleVoices: true, // ✅ 200+ voices across 50+ languages
				maxTextLength: 5000, // Google Cloud TTS limit per request
			},

			// Provider-specific extensions
			extensions: {
				supportsSpeechMarks: true, // ✅ Via SSML marks + timepoints
				supportedFormats: ["mp3", "wav", "ogg"], // MP3, LINEAR16, OGG_OPUS
				supportsSampleRate: true, // ✅ Configurable sample rate

				// Google Cloud-specific features
				providerSpecific: {
					voiceTypes: ["standard", "wavenet", "studio"],
					voicesCount: 200, // ~200+ voices available
					languagesCount: 50, // 50+ languages supported
					supportsAudioProfiles: true, // Audio device profiles
					supportsEffects: false, // No built-in effects
					supportsEmotions: false, // No emotion control
					supportsStyles: false, // No speaking styles
				},
			},
		};
	}

	/**
	 * Map Google Cloud errors to TTSError codes
	 */
	private mapGoogleErrorToTTSError(error: any): TTSError {
		const message = error.message || String(error);

		// Check for specific Google Cloud error codes
		if (error.code === 7) {
			// PERMISSION_DENIED
			return new TTSError(
				TTSErrorCode.AUTHENTICATION_ERROR,
				`Google Cloud authentication failed: ${message}`,
				{ error },
				this.providerId,
			);
		}

		if (error.code === 8) {
			// RESOURCE_EXHAUSTED
			return new TTSError(
				TTSErrorCode.RATE_LIMIT_EXCEEDED,
				`Google Cloud rate limit exceeded: ${message}`,
				{ error },
				this.providerId,
			);
		}

		if (error.code === 3) {
			// INVALID_ARGUMENT
			return new TTSError(
				TTSErrorCode.INVALID_REQUEST,
				`Invalid request to Google Cloud TTS: ${message}`,
				{ error },
				this.providerId,
			);
		}

		// Default to provider error
		return new TTSError(
			TTSErrorCode.PROVIDER_ERROR,
			`Google Cloud TTS error: ${message}`,
			{ error },
			this.providerId,
		);
	}

	/**
	 * Clean up Google Cloud TTS client
	 */
	async destroy(): Promise<void> {
		if (this.client) {
			await this.client.close();
		}
		await super.destroy();
	}
}
