/**
 * Tool Provider Interface
 *
 * Unified interface for all assessment tools that require
 * configuration, authentication, or external services.
 *
 * Examples: Desmos calculators, TI calculators, TTS services,
 * translation services, dictionary APIs, etc.
 *
 * Part of PIE Assessment Toolkit.
 */

/**
 * Tool category classification
 */
export type ToolCategory =
	| "calculator"
	| "tts"
	| "translation"
	| "dictionary"
	| "annotation"
	| "accessibility"
	| "other";

/**
 * Tool provider capabilities descriptor
 *
 * Describes what features and limitations a provider has.
 */
export interface ToolProviderCapabilities {
	/**
	 * Can be used offline (no network required)
	 */
	supportsOffline: boolean;

	/**
	 * Requires API key or authentication
	 */
	requiresAuth: boolean;

	/**
	 * Maximum concurrent instances (null = unlimited)
	 */
	maxInstances?: number | null;

	/**
	 * Provider-specific capabilities/features
	 * @example { graphing: true, scientific: true, basic: true }
	 */
	features: Record<string, boolean>;
}

/**
 * Tool Provider Interface
 *
 * Base interface for all tool providers in the assessment toolkit.
 * Providers are stateless factories that create configured tool instances.
 *
 * @template TConfig Configuration type for this provider
 * @template TInstance Instance type created by this provider
 *
 * @example
 * ```typescript
 * class DesmosToolProvider implements IToolProvider<DesmosConfig, CalculatorProvider> {
 *   readonly providerId = 'desmos-calculator';
 *   readonly providerName = 'Desmos Calculator';
 *   readonly category = 'calculator';
 *   // ...
 * }
 * ```
 */
export interface IToolProvider<TConfig = any, TInstance = any> {
	/**
	 * Unique identifier for this provider
	 *
	 * @example 'desmos-calculator', 'aws-polly-tts', 'ti-calculator'
	 */
	readonly providerId: string;

	/**
	 * Human-readable provider name
	 *
	 * @example 'Desmos Calculator', 'AWS Polly TTS'
	 */
	readonly providerName: string;

	/**
	 * Tool category for this provider
	 *
	 * @example 'calculator', 'tts', 'translation'
	 */
	readonly category: ToolCategory;

	/**
	 * Provider version
	 *
	 * @example '1.0', '2.5', '1.10'
	 */
	readonly version: string;

	/**
	 * Does this provider require authentication/API keys?
	 *
	 * When true, the provider should be initialized with auth credentials
	 * or an authFetcher function to retrieve them from a backend service.
	 */
	readonly requiresAuth: boolean;

	/**
	 * Initialize the provider
	 *
	 * Sets up the provider with configuration and prepares it for use.
	 * For auth-based providers, this is where API keys/tokens are validated.
	 *
	 * @param config Provider configuration (may include auth)
	 * @returns Promise that resolves when provider is ready
	 * @throws Error if initialization fails
	 */
	initialize(config: TConfig): Promise<void>;

	/**
	 * Create a tool instance
	 *
	 * Creates a configured instance of the tool ready for use.
	 * The provider must be initialized before calling this method.
	 *
	 * @param config Instance-specific configuration (optional)
	 * @returns Tool instance ready for use
	 * @throws Error if provider not initialized
	 */
	createInstance(config?: Partial<TConfig>): Promise<TInstance>;

	/**
	 * Get provider capabilities
	 *
	 * Returns a description of what this provider supports.
	 *
	 * @returns Capabilities descriptor
	 */
	getCapabilities(): ToolProviderCapabilities;

	/**
	 * Check if provider is ready to use
	 *
	 * Returns true if initialize() has completed successfully.
	 *
	 * @returns true if provider is initialized and ready
	 */
	isReady(): boolean;

	/**
	 * Clean up provider resources
	 *
	 * Destroys the provider and releases any resources (connections, timers, etc.).
	 * After calling this, the provider should not be used.
	 */
	destroy(): void;
}
