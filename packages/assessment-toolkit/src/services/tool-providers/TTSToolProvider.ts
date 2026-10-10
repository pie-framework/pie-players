/**
 * TTS Tool Provider
 *
 * Unified provider for both TTS backends:
 * - `browser`: the Web Speech API (no auth)
 * - `server`: a TTS server, its service named by the config's `provider`.
 *   `polly` and `google` run on the `pie` transport; `custom` runs on the
 *   `custom` transport to a host's own service, which takes `lang_id`,
 *   `speedRate` and `cache`
 *
 * Part of PIE Assessment Toolkit.
 */

import {
	createPieLogger,
	isTtsDebugEnabled,
} from "@pie-players/pie-players-shared/pie";
import type { ITTSProvider } from "@pie-players/pie-tts";
import { BrowserTTSProvider } from "../../services/tts/browser-provider.js";
import type {
	RuntimeTTSConfig,
	TTSRuntimeSettings,
} from "../tts-runtime-config.js";
import type { ToolProviderApi } from "./ToolProviderApi.js";

const logger = createPieLogger("tts-tool-provider", isTtsDebugEnabled);

export type TTSBackend = NonNullable<TTSRuntimeSettings["backend"]>;

/**
 * The runtime provider config plus the credentials and instrumentation this
 * tool provider reads. The backend is fixed at construction.
 */
export type TTSToolProviderConfig = RuntimeTTSConfig & {
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
type ServerBackendConfig = Omit<TTSToolProviderConfig, "onTelemetry">;

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
		getCapabilities: () => provider.getCapabilities(),
		destroy: () => provider.destroy(),
	};
}

/**
 * TTS Tool Provider
 *
 * Wraps the browser or a server TTS provider with the ToolProviderApi interface
 * for use in the ToolProviderRegistry.
 *
 * @example Browser TTS (no auth)
 * ```typescript
 * const provider = new TTSToolProvider();
 * await provider.initialize({});
 * const ttsProvider = await provider.createInstance();
 * ```
 *
 * @example Server TTS
 * ```typescript
 * const provider = new TTSToolProvider('server', {
 *   loadServerProvider: async () => ServerTTSProvider,
 * });
 * await provider.initialize({
 *   provider: 'polly',
 *   apiEndpoint: '/api/tts',
 * });
 * const ttsProvider = await provider.createInstance();
 * ```
 */
export class TTSToolProvider
	implements ToolProviderApi<ITTSProvider>
{
	readonly providerName = "Text-to-Speech";
	readonly category = "tts" as const;
	readonly version = "1.0";
	readonly requiresAuth: boolean;

	private readonly backend: TTSBackend;
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
		this.backend = backend;
		this.requiresAuth = backend !== "browser";
		this.loadServerProvider = options.loadServerProvider;
	}

	/**
	 * Initialize TTS provider
	 *
	 * Sets up the appropriate TTS backend.
	 *
	 * @param config Runtime configuration and credentials
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

		switch (this.backend) {
			case "browser":
				await this._initializeBrowserTTS();
				break;

			case "server":
				await this._initializeServerTTS(config);
				break;

			default:
				throw new Error(`[TTSToolProvider] Unknown backend: ${this.backend}`);
		}

		logger.debug(`initialized (backend: ${this.backend})`);
	}

	/**
	 * Initialize browser TTS (Web Speech API)
	 */
	private async _initializeBrowserTTS(): Promise<void> {
		// Check if Web Speech API is available
		if (typeof window === "undefined" || !("speechSynthesis" in window)) {
			throw new Error(
				"[TTSToolProvider] Browser TTS not supported (Web Speech API not available)",
			);
		}

		this.ttsProvider = new BrowserTTSProvider();
		logger.debug("browser TTS initialized (Web Speech API)");
	}

	/**
	 * Initialize server-based TTS
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

		const serverProvider = config.provider || this.backend;
		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry("pie-tool-library-load-start", {
			toolId: "textToSpeech",
			operation: "server-provider-module-import",
			backend: serverProvider,
		});
		const ServerProvider = await (async () => {
			try {
				const loaded = await loadServerProvider();
				await this.emitTelemetry("pie-tool-library-load-success", {
					toolId: "textToSpeech",
					operation: "server-provider-module-import",
					backend: serverProvider,
					duration: Date.now() - moduleLoadStartedAt,
				});
				return loaded;
			} catch (error) {
				await this.emitTelemetry("pie-tool-library-load-error", {
					toolId: "textToSpeech",
					operation: "server-provider-module-import",
					backend: serverProvider,
					duration: Date.now() - moduleLoadStartedAt,
					errorType: "ToolLibraryLoadError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		})();
		// The server adapter owns these fields, `mathTokenHighlighting` aside, which
		// is the toolkit's. Picking them from its config type fails the build when
		// one is renamed there or typed differently. The adapter is only a dev
		// dependency here, so it is named only in this body, which declaration
		// emit leaves out (ADR 0002).
		type ServerTTSProviderConfig =
			import("@pie-players/tts-client-server").ServerTTSProviderConfig;
		const { onTelemetry: _onTelemetry, ...backendConfig } = config;
		this.ttsProvider = bindServerBackendConfig(
			new ServerProvider(),
			backendConfig satisfies Partial<
				Pick<
					ServerTTSProviderConfig,
					Exclude<keyof ServerBackendConfig, "mathTokenHighlighting">
				>
			>,
		);

		logger.debug(
			`server TTS initialized (provider: ${serverProvider})`,
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
		logger.debug("destroyed");
	}
}
