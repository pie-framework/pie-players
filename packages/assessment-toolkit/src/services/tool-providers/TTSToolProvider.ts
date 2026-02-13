/**
 * TTS Tool Provider
 *
 * Unified provider for all TTS backends:
 * - Browser Web Speech API (no auth)
 * - AWS Polly (requires auth via server proxy)
 * - Google Cloud TTS (requires auth via server proxy)
 *
 * Part of PIE Assessment Toolkit.
 */

import type { ITTSProvider, TTSConfig } from "@pie-players/pie-tts";
import { BrowserTTSProvider } from "../../services/tts/browser-provider";
import type { IToolProvider, ToolProviderCapabilities } from "./IToolProvider";

/**
 * TTS backend type
 */
export type TTSBackend = "browser" | "polly" | "google" | "server";

/**
 * TTS tool provider configuration
 */
export interface TTSToolProviderConfig extends Partial<TTSConfig> {
	/**
	 * TTS backend to use
	 */
	backend: TTSBackend;

	/**
	 * Server API endpoint (for server backends)
	 * @example '/api/tts/synthesize'
	 * @example 'https://api.example.com/tts/synthesize'
	 */
	apiEndpoint?: string;

	/**
	 * Provider to use on server ('polly', 'google')
	 * Only used when backend is 'server', 'polly', or 'google'
	 */
	serverProvider?: "polly" | "google";

	/**
	 * Auth token (if required)
	 * Typically fetched via authFetcher in ToolProviderRegistry
	 */
	authToken?: string;

	/**
	 * Organization ID for multi-tenant applications
	 */
	organizationId?: string;

	/**
	 * Default voice to use
	 */
	voice?: string;

	/**
	 * Speech rate (0.25 to 4.0, default 1.0)
	 */
	rate?: number;

	/**
	 * Speech pitch (0 to 2, default 1.0)
	 * Note: Only browser backend supports pitch
	 */
	pitch?: number;
}

/**
 * TTS Tool Provider
 *
 * Wraps TTS providers (Browser, Polly, Google) with the IToolProvider interface
 * for use in the ToolProviderRegistry.
 *
 * @example Browser TTS (no auth)
 * ```typescript
 * const provider = new TTSToolProvider();
 * await provider.initialize({ backend: 'browser' });
 * const ttsProvider = await provider.createInstance();
 * ```
 *
 * @example Server TTS (with auth)
 * ```typescript
 * const provider = new TTSToolProvider();
 * await provider.initialize({
 *   backend: 'polly',
 *   apiEndpoint: '/api/tts/synthesize',
 *   authToken: 'bearer-token', // Fetched via authFetcher
 * });
 * const ttsProvider = await provider.createInstance();
 * ```
 */
export class TTSToolProvider
	implements IToolProvider<TTSToolProviderConfig, ITTSProvider>
{
	readonly providerId = "tts-service";
	readonly providerName = "Text-to-Speech";
	readonly category = "tts" as const;
	readonly version = "1.0";
	readonly requiresAuth: boolean;

	private ttsProvider: ITTSProvider | null = null;
	private config: TTSToolProviderConfig | null = null;

	/**
	 * Create TTS tool provider
	 *
	 * @param backend TTS backend to use (default: 'browser')
	 */
	constructor(backend: TTSBackend = "browser") {
		this.requiresAuth = backend !== "browser";
	}

	/**
	 * Initialize TTS provider
	 *
	 * Sets up the appropriate TTS backend.
	 *
	 * @param config Configuration with backend type and credentials
	 * @throws Error if initialization fails or required config missing
	 */
	async initialize(config: TTSToolProviderConfig): Promise<void> {
		if (this.ttsProvider) {
			console.warn(
				"[TTSToolProvider] Already initialized, skipping reinitialization",
			);
			return;
		}

		this.config = config;

		switch (config.backend) {
			case "browser":
				await this._initializeBrowserTTS(config);
				break;

			case "polly":
			case "google":
			case "server":
				await this._initializeServerTTS(config);
				break;

			default:
				throw new Error(`[TTSToolProvider] Unknown backend: ${config.backend}`);
		}

		console.log(
			`[TTSToolProvider] Initialized successfully (backend: ${config.backend})`,
		);
	}

	/**
	 * Initialize browser TTS (Web Speech API)
	 */
	private async _initializeBrowserTTS(
		config: TTSToolProviderConfig,
	): Promise<void> {
		// Check if Web Speech API is available
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			throw new Error(
				"[TTSToolProvider] Browser TTS not supported (Web Speech API not available)",
			);
		}

		this.ttsProvider = new BrowserTTSProvider();
		console.log("[TTSToolProvider] Browser TTS initialized (Web Speech API)");
	}

	/**
	 * Initialize server-based TTS (Polly, Google)
	 */
	private async _initializeServerTTS(
		config: TTSToolProviderConfig,
	): Promise<void> {
		if (!config.apiEndpoint) {
			throw new Error(
				"[TTSToolProvider] apiEndpoint required for server-based TTS backends",
			);
		}

		// Lazy-load ServerTTSProvider to avoid bundling if not needed
		try {
			const { ServerTTSProvider } = await import(
				"@pie-players/tts-client-server"
			);

			// Create provider instance (no constructor args, will be initialized on first use)
			this.ttsProvider = new ServerTTSProvider();

			console.log(
				`[TTSToolProvider] Server TTS initialized (provider: ${config.serverProvider || config.backend})`,
			);
		} catch (error) {
			console.error(
				"[TTSToolProvider] Failed to load ServerTTSProvider:",
				error,
			);
			throw new Error(
				"Failed to load server TTS provider. Ensure @pie-players/tts-client-server is installed.",
			);
		}
	}

	/**
	 * Create a TTS provider instance
	 *
	 * Returns the initialized TTS provider.
	 *
	 * @param config Optional instance-specific configuration (currently unused)
	 * @returns TTS provider
	 * @throws Error if provider not initialized
	 */
	async createInstance(
		config?: Partial<TTSToolProviderConfig>,
	): Promise<ITTSProvider> {
		if (!this.ttsProvider) {
			throw new Error(
				"[TTSToolProvider] Provider not initialized. Call initialize() first.",
			);
		}

		return this.ttsProvider;
	}

	/**
	 * Get provider capabilities
	 *
	 * @returns TTS capabilities based on backend
	 */
	getCapabilities(): ToolProviderCapabilities {
		const isBrowser = this.config?.backend === "browser";

		return {
			supportsOffline: isBrowser,
			requiresAuth: !isBrowser,
			maxInstances: 1, // Single TTS instance (playback is sequential)
			features: {
				wordBoundary: true, // All backends support word highlighting
				pause: true,
				resume: true,
				rateControl: true,
				pitchControl: isBrowser, // Only browser supports pitch
				voiceSelection: true,
			},
		};
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if provider is initialized
	 */
	isReady(): boolean {
		return this.ttsProvider !== null;
	}

	/**
	 * Clean up provider resources
	 *
	 * Destroys the TTS provider and releases resources.
	 */
	destroy(): void {
		if (this.ttsProvider) {
			this.ttsProvider.destroy();
			this.ttsProvider = null;
		}
		this.config = null;
		console.log("[TTSToolProvider] Destroyed");
	}
}
