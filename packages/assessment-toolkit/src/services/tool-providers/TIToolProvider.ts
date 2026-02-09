/**
 * TI Calculator Tool Provider
 *
 * Provides Texas Instruments calculator emulators (TI-84, TI-108, TI-34 MV).
 *
 * NOTE: Requires licensed TI emulator libraries from Texas Instruments.
 * These libraries must be hosted on your server at /lib/ti/{version}/
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	CalculatorProvider,
	TICalculatorConfig,
} from "@pie-players/pie-calculator";
import { TICalculatorProvider } from "../../tools/calculators/ti-provider";
import type { IToolProvider, ToolProviderCapabilities } from "./IToolProvider";

/**
 * TI tool provider configuration
 */
export interface TIToolProviderConfig {
	/**
	 * Base URL for TI emulator libraries
	 * @default '/lib/ti'
	 * @example '/static/calculators/ti'
	 * @example 'https://cdn.example.com/ti'
	 */
	libraryBaseUrl?: string;

	/**
	 * TI emulator version to load
	 * @default 'v2.8.0'
	 */
	version?: string;

	/**
	 * Default calculator configuration applied to all instances
	 */
	defaultConfig?: TICalculatorConfig;

	/**
	 * Restricted mode (test mode) - disables certain features
	 * @default false
	 */
	restrictedMode?: boolean;
}

/**
 * TI Calculator Tool Provider
 *
 * Wraps TICalculatorProvider with the IToolProvider interface
 * for use in the ToolProviderRegistry.
 *
 * TI calculators do not require API keys, but DO require
 * licensed emulator libraries to be hosted on your server.
 *
 * @example
 * ```typescript
 * const provider = new TIToolProvider();
 *
 * await provider.initialize({
 *   libraryBaseUrl: '/lib/ti',
 *   version: 'v2.8.0',
 *   restrictedMode: false,
 * });
 *
 * const calculatorProvider = await provider.createInstance();
 * ```
 */
export class TIToolProvider
	implements IToolProvider<TIToolProviderConfig, CalculatorProvider>
{
	readonly providerId = "ti-calculator";
	readonly providerName = "Texas Instruments Calculator";
	readonly category = "calculator" as const;
	readonly version = "2.8.0";
	readonly requiresAuth = false; // No API key needed, but requires licensed libraries

	private tiProvider: TICalculatorProvider | null = null;
	private config: TIToolProviderConfig | null = null;

	/**
	 * Initialize TI calculator provider
	 *
	 * Loads the TI emulator libraries (ELG shared library).
	 *
	 * @param config Configuration with library base URL and version
	 * @throws Error if initialization fails or libraries not found
	 */
	async initialize(config: TIToolProviderConfig): Promise<void> {
		if (this.tiProvider) {
			console.warn(
				"[TIToolProvider] Already initialized, skipping reinitialization",
			);
			return;
		}

		this.config = config;
		this.tiProvider = new TICalculatorProvider();

		// Initialize TI emulator libraries
		try {
			await this.tiProvider.initialize();
			console.log(
				"[TIToolProvider] Initialized successfully (TI emulator libraries loaded)",
			);
		} catch (error) {
			console.error("[TIToolProvider] Initialization failed:", error);
			throw new Error(
				"Failed to initialize TI calculator provider. Ensure TI emulator libraries are available.",
			);
		}
	}

	/**
	 * Create a calculator provider instance
	 *
	 * Returns the initialized TI calculator provider.
	 *
	 * @param config Optional instance-specific configuration (currently unused)
	 * @returns TI calculator provider
	 * @throws Error if provider not initialized
	 */
	async createInstance(
		config?: Partial<TIToolProviderConfig>,
	): Promise<CalculatorProvider> {
		if (!this.tiProvider) {
			throw new Error(
				"[TIToolProvider] Provider not initialized. Call initialize() first.",
			);
		}

		return this.tiProvider;
	}

	/**
	 * Get provider capabilities
	 *
	 * @returns TI calculator capabilities
	 */
	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: true, // Works offline once libraries loaded
			requiresAuth: false,
			maxInstances: null, // Unlimited calculator instances
			features: {
				"ti-84": true,
				"ti-108": true,
				"ti-34-mv": true,
				graphing: true, // TI-84 supports graphing
				scientific: true, // All TI models support scientific functions
			},
		};
	}

	/**
	 * Check if provider is ready
	 *
	 * @returns true if provider is initialized
	 */
	isReady(): boolean {
		return this.tiProvider !== null;
	}

	/**
	 * Clean up provider resources
	 *
	 * Destroys the TI calculator provider and releases resources.
	 */
	destroy(): void {
		if (this.tiProvider) {
			this.tiProvider.destroy();
			this.tiProvider = null;
		}
		this.config = null;
		console.log("[TIToolProvider] Destroyed");
	}
}
