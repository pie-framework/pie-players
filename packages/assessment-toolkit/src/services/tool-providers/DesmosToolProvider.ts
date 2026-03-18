/**
 * Desmos Calculator Tool Provider
 *
 * Provides Desmos calculators (basic, scientific, graphing)
 * with authentication and proxy support.
 *
 * SECURITY BEST PRACTICE:
 * - Development: Pass apiKey directly for local testing
 * - Production: Use proxyEndpoint or authFetcher to keep API key server-side
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	CalculatorProvider,
	DesmosCalculatorConfig,
} from "@pie-players/pie-calculator";
import type { ToolProviderApi, ToolProviderCapabilities } from "./ToolProviderApi.js";

/**
 * Desmos tool provider configuration
 */
export interface DesmosToolProviderConfig {
	/**
	 * Desmos API key (DEVELOPMENT ONLY)
	 * Never expose in production client code!
	 *
	 * Obtain from: https://www.desmos.com/api
	 */
	apiKey?: string;

	/**
	 * Server proxy endpoint (PRODUCTION RECOMMENDED)
	 * Backend handles API key securely
	 *
	 * @example '/api/desmos/token'
	 * @example 'https://api.myapp.com/tools/desmos/auth'
	 */
	proxyEndpoint?: string;

	/**
	 * Default calculator configuration applied to all instances
	 */
	defaultConfig?: DesmosCalculatorConfig;

	/**
	 * Optional telemetry callback for tool/backend instrumentation.
	 */
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

/**
 * Desmos Calculator Tool Provider
 *
 * Wraps DesmosCalculatorProvider with the ToolProviderApi interface
 * for use in the ToolProviderRegistry.
 *
 * @example
 * ```typescript
 * const provider = new DesmosToolProvider();
 *
 * await provider.initialize({
 *   apiKey: 'your-api-key', // Development only
 *   proxyEndpoint: '/api/desmos/token', // Production
 * });
 *
 * const calculatorProvider = await provider.createInstance();
 * ```
 */
export class DesmosToolProvider
	implements ToolProviderApi<DesmosToolProviderConfig, CalculatorProvider>
{
	readonly providerId = "desmos-calculator";
	readonly providerName = "Desmos Calculator";
	readonly category = "calculator" as const;
	readonly version = "1.10";
	readonly requiresAuth = true;

	private desmosProvider:
		| (CalculatorProvider & {
				initialize(config: {
					apiKey?: string;
					proxyEndpoint?: string;
					onTelemetry?: (
						eventName: string,
						payload?: Record<string, unknown>,
					) => void | Promise<void>;
				}): Promise<void>;
		  })
		| null = null;
	private config: DesmosToolProviderConfig | null = null;

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.config?.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[DesmosToolProvider] telemetry callback failed:", error);
		}
	}

	/**
	 * Initialize Desmos calculator provider
	 *
	 * Loads the Desmos API library and authenticates with provided credentials.
	 *
	 * @param config Configuration with API key or proxy endpoint
	 * @throws Error if initialization fails
	 */
	async initialize(config: DesmosToolProviderConfig): Promise<void> {
		if (this.desmosProvider) {
			console.warn(
				"[DesmosToolProvider] Already initialized, skipping reinitialization",
			);
			return;
		}

		this.config = config;
		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry("pie-tool-library-load-start", {
			toolId: "calculator",
			operation: "desmos-provider-module-import",
			backend: "desmos",
		});
		const desmosModule = await (async () => {
			try {
				const loaded = (await import("@pie-players/pie-calculator-desmos")) as {
					DesmosCalculatorProvider: new () => CalculatorProvider & {
						initialize(config: {
							apiKey?: string;
							proxyEndpoint?: string;
							onTelemetry?: (
								eventName: string,
								payload?: Record<string, unknown>,
							) => void | Promise<void>;
						}): Promise<void>;
					};
				};
				await this.emitTelemetry("pie-tool-library-load-success", {
					toolId: "calculator",
					operation: "desmos-provider-module-import",
					backend: "desmos",
					duration: Date.now() - moduleLoadStartedAt,
				});
				return loaded;
			} catch (error) {
				await this.emitTelemetry("pie-tool-library-load-error", {
					toolId: "calculator",
					operation: "desmos-provider-module-import",
					backend: "desmos",
					duration: Date.now() - moduleLoadStartedAt,
					errorType: "ToolLibraryLoadError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		})();
		this.desmosProvider = new desmosModule.DesmosCalculatorProvider();

		// Initialize with API key or proxy
		try {
			await this.desmosProvider.initialize({
				apiKey: config.apiKey,
				proxyEndpoint: config.proxyEndpoint,
				onTelemetry: config.onTelemetry,
			});

			console.log(
				`[DesmosToolProvider] Initialized successfully ${
					config.proxyEndpoint
						? "(using proxy)"
						: config.apiKey
							? "(direct API key)"
							: "(no auth)"
				}`,
			);
		} catch (error) {
			console.error("[DesmosToolProvider] Initialization failed:", error);
			throw new Error(
				"Failed to initialize Desmos calculator provider. Check API key or proxy endpoint.",
			);
		}
	}

	/**
	 * Create a calculator provider instance
	 *
	 * Returns the initialized Desmos calculator provider.
	 *
	 * @param config Optional instance-specific configuration (currently unused)
	 * @returns Desmos calculator provider
	 * @throws Error if provider not initialized
	 */
	async createInstance(
		config?: Partial<DesmosToolProviderConfig>,
	): Promise<CalculatorProvider> {
		if (!this.desmosProvider) {
			throw new Error(
				"[DesmosToolProvider] Provider not initialized. Call initialize() first.",
			);
		}

		return this.desmosProvider;
	}

	/**
	 * Get provider capabilities
	 *
	 * @returns Desmos calculator capabilities
	 */
	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: false, // Requires Desmos CDN
			requiresAuth: true,
			maxInstances: null, // Unlimited calculator instances
			features: {
				basic: true,
				scientific: true,
				graphing: true,
				fourFunction: true,
			},
		};
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if provider is initialized
	 */
	isReady(): boolean {
		return this.desmosProvider !== null;
	}

	/**
	 * Clean up provider resources
	 *
	 * Destroys the Desmos calculator provider and releases resources.
	 */
	destroy(): void {
		if (this.desmosProvider) {
			this.desmosProvider.destroy();
			this.desmosProvider = null;
		}
		this.config = null;
		console.log("[DesmosToolProvider] Destroyed");
	}
}
