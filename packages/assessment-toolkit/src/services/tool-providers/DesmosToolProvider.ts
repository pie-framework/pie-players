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
import { DesmosCalculatorProvider } from "@pie-players/pie-calculator-desmos";
import type { IToolProvider, ToolProviderCapabilities } from "./IToolProvider.js";

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
}

/**
 * Desmos Calculator Tool Provider
 *
 * Wraps DesmosCalculatorProvider with the IToolProvider interface
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
	implements IToolProvider<DesmosToolProviderConfig, CalculatorProvider>
{
	readonly providerId = "desmos-calculator";
	readonly providerName = "Desmos Calculator";
	readonly category = "calculator" as const;
	readonly version = "1.10";
	readonly requiresAuth = true;

	private desmosProvider: DesmosCalculatorProvider | null = null;
	private config: DesmosToolProviderConfig | null = null;

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
		this.desmosProvider = new DesmosCalculatorProvider();

		// Initialize with API key or proxy
		try {
			await this.desmosProvider.initialize({
				apiKey: config.apiKey,
				proxyEndpoint: config.proxyEndpoint,
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
