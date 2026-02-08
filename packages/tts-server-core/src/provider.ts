/**
 * Server-side TTS Provider interface
 * @module @pie-players/tts-server-core
 */

import type {
	GetVoicesOptions,
	ServerProviderCapabilities,
	SynthesizeRequest,
	SynthesizeResponse,
	Voice,
} from "./types.js";

/**
 * Base configuration for TTS providers
 */
export interface TTSServerConfig {
	/** Provider-specific configuration */
	[key: string]: unknown;
}

/**
 * Server-side TTS Provider interface
 *
 * All server-side TTS providers must implement this interface.
 * Providers handle synthesis requests and return audio with speech marks.
 *
 * ## Initialization Performance
 *
 * The `initialize()` method MUST be fast and lightweight:
 * - Should only validate config and create API clients
 * - MUST NOT fetch voices or make expensive API calls
 * - MUST NOT perform test synthesis requests
 *
 * Use `getVoices()` explicitly when voice discovery is needed (e.g., in demo/admin UIs).
 * Runtime synthesis should work with hardcoded voice IDs without querying available voices.
 *
 * @example Fast initialization (runtime)
 * ```typescript
 * const provider = new PollyServerProvider();
 * await provider.initialize({ region: 'us-east-1', defaultVoice: 'Joanna' });
 * // Ready to synthesize immediately - no voices query
 * await provider.synthesize({ text: 'Hello', voice: 'Joanna' });
 * ```
 *
 * @example Explicit voice discovery (admin/demo UIs)
 * ```typescript
 * const provider = new PollyServerProvider();
 * await provider.initialize({ region: 'us-east-1' });
 * const voices = await provider.getVoices(); // Explicit, separate call
 * ```
 */
export interface ITTSServerProvider {
	/**
	 * Unique provider identifier (e.g., 'aws-polly', 'google-cloud-tts')
	 */
	readonly providerId: string;

	/**
	 * Human-readable provider name
	 */
	readonly providerName: string;

	/**
	 * Provider version
	 */
	readonly version: string;

	/**
	 * Initialize the provider with configuration.
	 *
	 * MUST be fast and lightweight - only validates config and creates clients.
	 * MUST NOT fetch voices or make expensive API calls during initialization.
	 *
	 * @param config - Provider-specific configuration
	 * @throws {TTSError} If initialization fails
	 * @performance Should complete in <100ms
	 */
	initialize(config: TTSServerConfig): Promise<void>;

	/**
	 * Synthesize speech from text
	 *
	 * @param request - Synthesis request parameters
	 * @returns Audio data and speech marks
	 * @throws {TTSError} If synthesis fails
	 */
	synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse>;

	/**
	 * Get available voices (explicit, secondary query).
	 *
	 * This is an EXPLICIT operation for voice discovery in demo/admin UIs.
	 * NOT called during initialization - call separately when needed.
	 *
	 * @param options - Optional filters for voices
	 * @returns List of available voices
	 * @throws {TTSError} If voice listing fails
	 * @note May take 200-500ms depending on provider
	 */
	getVoices(options?: GetVoicesOptions): Promise<Voice[]>;

	/**
	 * Get provider capabilities (synchronous, fast).
	 *
	 * Returns static capability information without API calls.
	 *
	 * @returns Provider feature support
	 * @performance Should complete in <1ms (synchronous)
	 */
	getCapabilities(): ServerProviderCapabilities;

	/**
	 * Clean up provider resources
	 * Called when provider is no longer needed
	 */
	destroy(): Promise<void>;
}

/**
 * Abstract base class for TTS providers
 * Provides common functionality and helpers
 */
export abstract class BaseTTSProvider implements ITTSServerProvider {
	abstract readonly providerId: string;
	abstract readonly providerName: string;
	abstract readonly version: string;

	protected config: TTSServerConfig = {};
	protected initialized = false;

	abstract initialize(config: TTSServerConfig): Promise<void>;
	abstract synthesize(request: SynthesizeRequest): Promise<SynthesizeResponse>;
	abstract getVoices(options?: GetVoicesOptions): Promise<Voice[]>;
	abstract getCapabilities(): ServerProviderCapabilities;

	async destroy(): Promise<void> {
		this.initialized = false;
		this.config = {};
	}

	/**
	 * Ensure provider is initialized before operations
	 * @throws {TTSError} If provider not initialized
	 */
	protected ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error(`Provider ${this.providerId} not initialized`);
		}
	}

	/**
	 * Validate synthesis request
	 * @throws {TTSError} If request is invalid
	 */
	protected validateRequest(
		request: SynthesizeRequest,
		capabilities: ServerProviderCapabilities,
	): void {
		if (!request.text || request.text.trim().length === 0) {
			throw new Error("Text is required and cannot be empty");
		}

		if (request.text.length > capabilities.standard.maxTextLength) {
			throw new Error(
				`Text length (${request.text.length}) exceeds maximum (${capabilities.standard.maxTextLength})`,
			);
		}

		if (
			request.format &&
			!capabilities.extensions.supportedFormats.includes(request.format)
		) {
			throw new Error(
				`Format '${request.format}' not supported. Supported formats: ${capabilities.extensions.supportedFormats.join(", ")}`,
			);
		}

		if (
			request.rate !== undefined &&
			(request.rate < 0.25 || request.rate > 4.0)
		) {
			throw new Error("Rate must be between 0.25 and 4.0");
		}

		if (
			request.pitch !== undefined &&
			(request.pitch < -20 || request.pitch > 20)
		) {
			throw new Error("Pitch must be between -20 and 20");
		}

		if (
			request.volume !== undefined &&
			(request.volume < 0 || request.volume > 1)
		) {
			throw new Error("Volume must be between 0 and 1");
		}
	}
}
