/**
 * Server-side TTS Provider interface
 * @module @pie-players/tts-server-core
 */

import type {
  SynthesizeRequest,
  SynthesizeResponse,
  Voice,
  GetVoicesOptions,
  ServerProviderCapabilities,
} from './types.js';

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
   * Initialize the provider with configuration
   *
   * @param config - Provider-specific configuration
   * @throws {TTSError} If initialization fails
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
   * Get available voices
   *
   * @param options - Optional filters for voices
   * @returns List of available voices
   * @throws {TTSError} If voice listing fails
   */
  getVoices(options?: GetVoicesOptions): Promise<Voice[]>;

  /**
   * Get provider capabilities
   *
   * @returns Provider feature support
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
  protected validateRequest(request: SynthesizeRequest, capabilities: ServerProviderCapabilities): void {
    if (!request.text || request.text.trim().length === 0) {
      throw new Error('Text is required and cannot be empty');
    }

    if (request.text.length > capabilities.maxTextLength) {
      throw new Error(
        `Text length (${request.text.length}) exceeds maximum (${capabilities.maxTextLength})`
      );
    }

    if (request.format && !capabilities.supportedFormats.includes(request.format)) {
      throw new Error(
        `Format '${request.format}' not supported. Supported formats: ${capabilities.supportedFormats.join(', ')}`
      );
    }

    if (request.rate !== undefined && (request.rate < 0.25 || request.rate > 4.0)) {
      throw new Error('Rate must be between 0.25 and 4.0');
    }

    if (request.pitch !== undefined && (request.pitch < -20 || request.pitch > 20)) {
      throw new Error('Pitch must be between -20 and 20');
    }

    if (request.volume !== undefined && (request.volume < 0 || request.volume > 1)) {
      throw new Error('Volume must be between 0 and 1');
    }
  }
}
