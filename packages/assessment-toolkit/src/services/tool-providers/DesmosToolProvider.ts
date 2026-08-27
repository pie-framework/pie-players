/**
 * Desmos Calculator Tool Provider
 *
 * Provides Desmos calculators (basic, scientific, graphing)
 * through the separately licensed Desmos browser API.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { CalculatorProvider } from "@pie-players/pie-calculator";
import type {
	ToolProviderApi,
	ToolProviderCapabilities,
} from "./ToolProviderApi.js";

/**
 * Desmos tool provider configuration
 *
 * Auth and telemetry only. Per-calculator Desmos options are owned by the
 * calculator component, which derives them from the calculator type and passes
 * them to `createCalculator()` directly — this provider never sees that config,
 * so a defaults field here would silently do nothing.
 */
export interface DesmosToolProviderConfig {
	/**
	 * Desmos API key licensed for this application.
	 *
	 * Desmos requires this key in the browser's calculator.js URL. Supplying it
	 * through an authFetcher keeps it out of static source and bundles, but does
	 * not make it secret from the browser.
	 *
	 * Obtain from: https://www.desmos.com/my-api
	 */
	apiKey?: string;

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
 *   apiKey: 'your-application-api-key',
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
	readonly version = "1.12";
	readonly requiresAuth = true;

	private desmosProvider:
		| (CalculatorProvider & {
				initialize(config: {
					apiKey?: string;
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
	 * @param config Configuration with an application key, or no key for the
	 * backwards-compatible unkeyed load/preloaded API path
	 * @throws Error if initialization fails
	 */
	async initialize(config: DesmosToolProviderConfig = {}): Promise<void> {
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

		// Preserve the unkeyed path for existing hosts while allowing licensed
		// deployments to supply the application key through provider init/runtime.
		try {
			await this.desmosProvider.initialize({
				apiKey: config.apiKey,
				onTelemetry: config.onTelemetry,
			});

			console.log(
				`[DesmosToolProvider] Initialized successfully ${config.apiKey ? "(API key supplied)" : "(compatibility path)"}`,
			);
		} catch (error) {
			console.error("[DesmosToolProvider] Initialization failed:", error);
			this.desmosProvider.destroy();
			this.desmosProvider = null;
			this.config = null;
			throw new Error(
				"Failed to initialize Desmos calculator provider. Check the application key, preloaded API, or network access.",
				{ cause: error },
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
