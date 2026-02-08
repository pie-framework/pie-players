/**
 * AWS Polly server-side TTS provider
 * @module @pie-players/tts-server-polly
 */

import {
	DescribeVoicesCommand,
	type DescribeVoicesCommandInput,
	Engine,
	OutputFormat,
	PollyClient,
	SpeechMarkType,
	SynthesizeSpeechCommand,
	VoiceId,
} from "@aws-sdk/client-polly";

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
 * AWS Polly provider configuration.
 *
 * This extends the base TTSServerConfig with Polly-specific settings.
 * All fields marked with @extension are AWS-specific and not portable.
 */
export interface PollyProviderConfig extends TTSServerConfig {
	/**
	 * AWS region (e.g., 'us-east-1', 'us-west-2', 'eu-west-1')
	 *
	 * @extension AWS-specific (region concept)
	 * @required
	 */
	region: string;

	/**
	 * AWS credentials for API authentication
	 *
	 * @extension AWS-specific
	 * @note In production, prefer IAM roles over hardcoded credentials
	 * @see https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials.html
	 */
	credentials?: {
		accessKeyId: string;
		secretAccessKey: string;
		sessionToken?: string;
	};

	/**
	 * Polly engine type: 'neural' (higher quality) or 'standard' (lower cost)
	 *
	 * @extension AWS Polly-specific
	 * @default 'neural'
	 * @note Neural: $16/1M chars, Standard: $4/1M chars
	 */
	engine?: "neural" | "standard";

	/**
	 * Default voice ID if not specified in synthesis requests
	 *
	 * @standard Voice selection is standard, but voice names are provider-specific
	 * @default 'Joanna'
	 * @see https://docs.aws.amazon.com/polly/latest/dg/voicelist.html
	 */
	defaultVoice?: string;
}

/**
 * AWS Polly Server Provider
 *
 * Provides high-quality neural text-to-speech with precise word-level timing
 * through AWS Polly speech marks.
 *
 * Features:
 * - Native speech marks support (millisecond precision)
 * - Neural and standard voices
 * - 25+ languages
 * - Full SSML support
 * - Parallel audio + speech marks requests
 */
export class PollyServerProvider extends BaseTTSProvider {
	readonly providerId = "aws-polly";
	readonly providerName = "AWS Polly";
	readonly version = "1.0.0";

	private client!: PollyClient;
	private engine: "neural" | "standard" = "neural";
	private defaultVoice = "Joanna";

	/**
	 * Initialize the AWS Polly provider.
	 *
	 * This is FAST and lightweight - only validates config and creates the Polly client.
	 * Does NOT fetch voices or make test API calls.
	 *
	 * @param config - Polly configuration with region and credentials
	 * @performance Completes in ~10-50ms
	 */
	async initialize(config: PollyProviderConfig): Promise<void> {
		if (!config.region) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				"AWS region is required",
				undefined,
				this.providerId,
			);
		}

		this.config = config;
		this.engine = config.engine || "neural";
		this.defaultVoice = config.defaultVoice || "Joanna";

		try {
			// Create Polly client (fast - no API calls)
			this.client = new PollyClient({
				region: config.region,
				credentials: config.credentials,
			});

			this.initialized = true;
			// NOTE: We do NOT call getVoices() here - that's an explicit secondary operation
		} catch (error) {
			throw new TTSError(
				TTSErrorCode.INITIALIZATION_ERROR,
				`Failed to initialize AWS Polly: ${error instanceof Error ? error.message : String(error)}`,
				{ error },
				this.providerId,
			);
		}
	}

	/**
	 * Synthesize speech with AWS Polly
	 */
	async synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse> {
		this.ensureInitialized();

		const capabilities = this.getCapabilities();
		this.validateRequest(request, capabilities);

		const voice = request.voice || this.defaultVoice;
		const startTime = Date.now();

		try {
			// Make parallel requests for audio and speech marks
			const [audioResponse, speechMarksResponse] = await Promise.all([
				this.synthesizeAudio(request, voice),
				request.includeSpeechMarks !== false
					? this.synthesizeSpeechMarks(request, voice)
					: Promise.resolve([]),
			]);

			const duration = (Date.now() - startTime) / 1000;

			return {
				audio: audioResponse.audio,
				contentType: audioResponse.contentType,
				speechMarks: speechMarksResponse,
				metadata: {
					providerId: this.providerId,
					voice,
					duration,
					charCount: request.text.length,
					cached: false,
					timestamp: new Date().toISOString(),
				},
			};
		} catch (error) {
			throw new TTSError(
				TTSErrorCode.PROVIDER_ERROR,
				`AWS Polly synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
				{ error, request },
				this.providerId,
			);
		}
	}

	/**
	 * Synthesize audio stream
	 */
	private async synthesizeAudio(
		request: SynthesizeRequest,
		voice: string,
	): Promise<{ audio: Buffer; contentType: string }> {
		// Detect if text contains SSML tags
		const isSsml =
			request.text.includes("<speak") ||
			request.text.includes("<emphasis") ||
			request.text.includes("<break") ||
			request.text.includes("<prosody") ||
			request.text.includes("<phoneme") ||
			request.text.includes("<amazon:") ||
			request.text.includes("<aws-");

		const textType = isSsml ? "ssml" : "text";

		if (isSsml) {
			console.log(
				"[PollyServerProvider] Detected SSML content, using TextType: ssml",
			);
		}

		const command = new SynthesizeSpeechCommand({
			Engine: this.engine === "neural" ? Engine.NEURAL : Engine.STANDARD,
			OutputFormat: OutputFormat.MP3,
			Text: request.text,
			TextType: textType,
			VoiceId: voice as VoiceId,
			SampleRate: String(request.sampleRate || 24000),
		});

		const response = await this.client.send(command);

		if (!response.AudioStream) {
			throw new Error("No audio stream received from AWS Polly");
		}

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		const stream = response.AudioStream;

		if (Symbol.asyncIterator in stream) {
			for await (const chunk of stream as AsyncIterable<Uint8Array>) {
				chunks.push(chunk);
			}
		} else if (stream instanceof Uint8Array) {
			chunks.push(stream);
		}

		const audioBuffer = Buffer.concat(chunks);

		return {
			audio: audioBuffer,
			contentType: response.ContentType || "audio/mpeg",
		};
	}

	/**
	 * Synthesize speech marks
	 */
	private async synthesizeSpeechMarks(
		request: SynthesizeRequest,
		voice: string,
	): Promise<SpeechMark[]> {
		// Detect if text contains SSML tags (same logic as audio synthesis)
		const isSsml =
			request.text.includes("<speak") ||
			request.text.includes("<emphasis") ||
			request.text.includes("<break") ||
			request.text.includes("<prosody") ||
			request.text.includes("<phoneme") ||
			request.text.includes("<amazon:") ||
			request.text.includes("<aws-");

		const textType = isSsml ? "ssml" : "text";

		const command = new SynthesizeSpeechCommand({
			Engine: this.engine === "neural" ? Engine.NEURAL : Engine.STANDARD,
			OutputFormat: OutputFormat.JSON,
			Text: request.text,
			TextType: textType,
			VoiceId: voice as VoiceId,
			SpeechMarkTypes: [SpeechMarkType.WORD],
		});

		const response = await this.client.send(command);

		if (!response.AudioStream) {
			return [];
		}

		// Convert stream to text
		const chunks: Uint8Array[] = [];
		const stream = response.AudioStream;

		if (Symbol.asyncIterator in stream) {
			for await (const chunk of stream as AsyncIterable<Uint8Array>) {
				chunks.push(chunk);
			}
		} else if (stream instanceof Uint8Array) {
			chunks.push(stream);
		}

		const marksText = Buffer.concat(chunks).toString("utf-8");

		// Parse NDJSON (newline-delimited JSON)
		// Each line is a separate JSON object
		const speechMarks = marksText
			.trim()
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => {
				const mark = JSON.parse(line);
				return {
					time: mark.time,
					type: "word" as const,
					start: mark.start,
					end: mark.end,
					value: mark.value,
				};
			});

		return speechMarks;
	}

	/**
	 * Get available voices from AWS Polly
	 */
	async getVoices(options?: GetVoicesOptions): Promise<Voice[]> {
		this.ensureInitialized();

		try {
			const input: DescribeVoicesCommandInput = {
				Engine: this.engine === "neural" ? Engine.NEURAL : Engine.STANDARD,
			};

			if (options?.language) {
				input.LanguageCode = options.language as any;
			}

			const command = new DescribeVoicesCommand(input);
			const response = await this.client.send(command);

			if (!response.Voices) {
				return [];
			}

			return response.Voices.map((voice) => ({
				id: voice.Id!,
				name: voice.Name!,
				language: voice.LanguageName!,
				languageCode: voice.LanguageCode!,
				gender: voice.Gender?.toLowerCase() as
					| "male"
					| "female"
					| "neutral"
					| undefined,
				quality: (this.engine === "neural" ? "neural" : "standard") as
					| "neural"
					| "standard"
					| "premium",
				supportedFeatures: {
					ssml: true,
					emotions: false,
					styles: false,
				},
				providerMetadata: {
					supportedEngines: voice.SupportedEngines,
					additionalLanguageCodes: voice.AdditionalLanguageCodes,
				},
			})).filter((voice) => {
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
	 * Get AWS Polly capabilities.
	 *
	 * Clearly documents what features are W3C-standard vs AWS-specific.
	 */
	getCapabilities(): ServerProviderCapabilities {
		return {
			// W3C Standard features
			standard: {
				supportsSSML: true, // ✅ Full SSML 1.1 + AWS extensions
				supportsPitch: true, // ✅ Via SSML <prosody pitch> (not direct API param)
				supportsRate: true, // ✅ Via SSML <prosody rate> (not direct API param)
				supportsVolume: false, // ❌ Not supported by Polly API (handle client-side)
				supportsMultipleVoices: true, // ✅ 60+ voices across 25+ languages
				maxTextLength: 3000, // AWS Polly limit per request
			},

			// Provider-specific extensions
			extensions: {
				supportsSpeechMarks: true, // ✅ Native WORD speech marks (millisecond precision)
				supportedFormats: ["mp3"], // Currently MP3 only (could add ogg, pcm)
				supportsSampleRate: true, // ✅ Configurable sample rate

				// AWS Polly-specific features
				providerSpecific: {
					engines: ["neural", "standard"], // Engine selection
					supportedSpeechMarkTypes: ["word"], // Currently only WORD (could add sentence, ssml, viseme)
					supportsLexicons: false, // Not yet implemented
					awsSSMLExtensions: true, // <aws-break>, <aws-emphasis>, <aws-w>, etc.
					neuralVoicesCount: 30, // ~30 neural voices available
					standardVoicesCount: 30, // ~30 standard voices available
					languagesCount: 25, // 25+ languages supported
				},
			},
		};
	}

	/**
	 * Clean up AWS Polly client
	 */
	async destroy(): Promise<void> {
		if (this.client) {
			this.client.destroy();
		}
		await super.destroy();
	}
}
