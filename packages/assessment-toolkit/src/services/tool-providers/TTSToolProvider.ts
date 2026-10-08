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

import type { ITTSProvider } from "@pie-players/pie-tts";
import { BrowserTTSProvider } from "../../services/tts/browser-provider.js";
import type {
	RuntimeTTSConfig,
	TTSRuntimeSettings,
} from "../tts-runtime-config.js";
import type {
	ToolProviderApi,
	ToolProviderCapabilities,
} from "./ToolProviderApi.js";

export type TTSBackend = NonNullable<TTSRuntimeSettings["backend"]>;

/**
 * The runtime provider config plus the backend selection and instrumentation
 * this tool provider reads.
 */
export type TTSToolProviderConfig = RuntimeTTSConfig & {
	backend: TTSBackend;
	serverProvider?: TTSRuntimeSettings["serverProvider"];
	/**
	 * Bearer token for a server backend, sent as `Authorization`. A host supplies
	 * it through `provider.runtime.authFetcher`.
	 */
	authToken?: string;
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
};

/**
 * Construction options. `loadServerProvider` resolves the server adapter's
 * provider class; a server backend fails to initialize without it. The toolkit
 * leaves the adapter to its caller so that a bundler building the toolkit never
 * has to resolve `@pie-players/tts-client-server`.
 */
export type TTSToolProviderOptions = {
	loadServerProvider?: () => Promise<new () => ITTSProvider>;
};

/** The part of `TTSToolProviderConfig` a server backend's provider reads. */
type ServerBackendConfig = Omit<
	TTSToolProviderConfig,
	"backend" | "serverProvider" | "onTelemetry"
>;

/**
 * Binds a server backend's provider to the config the registry initialized this
 * tool provider with, including what `provider.runtime.authFetcher` returned.
 * The bound config wins over the runtime config the TTS service initializes the
 * provider with; `headers` and `providerOptions` merge key by key, keeping the
 * host's headers and the service's telemetry reporter.
 */
function bindServerBackendConfig(
	provider: ITTSProvider,
	bound: ServerBackendConfig,
): ITTSProvider {
	return {
		providerId: provider.providerId,
		providerName: provider.providerName,
		version: provider.version,
		initialize: (config) => {
			const runtime = config as ServerBackendConfig;
			const merged: ServerBackendConfig = {
				...runtime,
				...bound,
				headers: { ...runtime.headers, ...bound.headers },
				providerOptions: {
					...runtime.providerOptions,
					...bound.providerOptions,
				},
			};
			return provider.initialize(merged);
		},
		supportsFeature: (feature) => provider.supportsFeature(feature),
		getCapabilities: () => provider.getCapabilities(),
		destroy: () => provider.destroy(),
	};
}

/**
 * TTS Tool Provider
 *
 * Wraps TTS providers (Browser, Polly, Google) with the ToolProviderApi interface
 * for use in the ToolProviderRegistry.
 *
 * @example Browser TTS (no auth)
 * ```typescript
 * const provider = new TTSToolProvider();
 * await provider.initialize({ backend: 'browser' });
 * const ttsProvider = await provider.createInstance();
 * ```
 *
 * @example Server TTS
 * ```typescript
 * const provider = new TTSToolProvider('polly', {
 *   loadServerProvider: async () => ServerTTSProvider,
 * });
 * await provider.initialize({
 *   backend: 'polly',
 *   apiEndpoint: '/api/tts',
 * });
 * const ttsProvider = await provider.createInstance();
 * ```
 */
export class TTSToolProvider
	implements ToolProviderApi<TTSToolProviderConfig, ITTSProvider>
{
	readonly providerName = "Text-to-Speech";
	readonly category = "tts" as const;
	readonly version = "1.0";
	readonly requiresAuth: boolean;

	private ttsProvider: ITTSProvider | null = null;
	private config: TTSToolProviderConfig | null = null;
	private readonly loadServerProvider: TTSToolProviderOptions["loadServerProvider"];

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.config?.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[TTSToolProvider] telemetry callback failed:", error);
		}
	}

	/**
	 * Create TTS tool provider
	 *
	 * @param backend TTS backend to use (default: 'browser')
	 * @param options Loader for the server adapter, required by server backends
	 */
	constructor(
		backend: TTSBackend = "browser",
		options: TTSToolProviderOptions = {},
	) {
		this.requiresAuth = backend !== "browser";
		this.loadServerProvider = options.loadServerProvider;
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

		const loadServerProvider = this.loadServerProvider;
		if (!loadServerProvider) {
			throw new Error(
				"[TTSToolProvider] server-based TTS backends need the loadServerProvider option",
			);
		}

		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry("pie-tool-library-load-start", {
			toolId: "textToSpeech",
			operation: "server-provider-module-import",
			backend: config.serverProvider || config.backend,
		});
		const ServerProvider = await (async () => {
			try {
				const loaded = await loadServerProvider();
				await this.emitTelemetry("pie-tool-library-load-success", {
					toolId: "textToSpeech",
					operation: "server-provider-module-import",
					backend: config.serverProvider || config.backend,
					duration: Date.now() - moduleLoadStartedAt,
				});
				return loaded;
			} catch (error) {
				await this.emitTelemetry("pie-tool-library-load-error", {
					toolId: "textToSpeech",
					operation: "server-provider-module-import",
					backend: config.serverProvider || config.backend,
					duration: Date.now() - moduleLoadStartedAt,
					errorType: "ToolLibraryLoadError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		})();
		// The server adapter owns these fields. Picking them from its config type
		// fails the build when one is renamed there or typed differently. The
		// adapter is only a dev dependency here, so it is named only in this body,
		// which declaration emit leaves out (ADR 0002).
		type ServerTTSProviderConfig =
			import("@pie-players/tts-client-server").ServerTTSProviderConfig;
		const { backend, serverProvider, onTelemetry, ...backendConfig } = config;
		this.ttsProvider = bindServerBackendConfig(
			new ServerProvider(),
			backendConfig satisfies Partial<
				Pick<ServerTTSProviderConfig, keyof ServerBackendConfig>
			>,
		);

		console.log(
			`[TTSToolProvider] Server TTS initialized (provider: ${config.serverProvider || config.backend})`,
		);
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
