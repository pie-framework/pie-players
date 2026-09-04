/**
 * Calculator Provider Interfaces
 *
 * Defines the contract for calculator providers.
 * Providers are stateless factories that create configured calculator implementations.
 *
 * Part of PIE Calculator - No UI dependencies.
 */

/**
 * Calculator types
 */
export type CalculatorType = "basic" | "scientific" | "graphing";

/**
 * Provider-level initialization: credentials and instrumentation.
 *
 * Distinct from `CalculatorProviderConfig`, which configures one calculator
 * instance. A hosted calculator vendor needs a key, or a server endpoint that
 * mints one — never both in production, since `apiKey` puts the key in the
 * browser.
 *
 * Naming across adapters, so a host reading one knows where to look in the
 * others: `<Vendor>CalculatorSettings` is the vendor option shape,
 * `<Vendor>CalculatorProviderConfig` is `CalculatorProviderConfig` with
 * `settings` narrowed to it, and `<Vendor>CalculatorProviderInit` appears only
 * where the adapter narrows or extends this interface — Cortex and GeoGebra take
 * no credential, Desmos takes this type whole and declares no alias for it.
 */
export interface CalculatorProviderInit {
	/** Vendor API key. Development only — it reaches the browser. */
	apiKey?: string;
	/** Host endpoint that serves the vendor credential. Production. */
	proxyEndpoint?: string;
	/** Instrumentation callback for library-load and auth events. */
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

/**
 * Provider-neutral calculator configuration.
 *
 * Adapters own the shape and interpretation of `settings`; the generic
 * calculator seam deliberately does not name an implementation. An adapter
 * narrows `settings` in its own `<Vendor>CalculatorProviderConfig`, which is the
 * only reason a caller ever gets vendor option names.
 */
export interface CalculatorProviderConfig {
	settings?: Record<string, unknown>;
	restrictedMode?: boolean; // Quick toggle for restricted/test mode (affects multiple options)
	locale?: string;
	theme?: "light" | "dark" | "auto";
}

/**
 * Calculator provider capabilities
 */
export interface CalculatorProviderCapabilities {
	supportsHistory: boolean;
	supportsGraphing: boolean;
	supportsExpressions: boolean;
	canExport: boolean;
	maxPrecision?: number;
	inputMethods: ("keyboard" | "mouse" | "touch")[];
}

/**
 * Calculation history entry
 */
export interface CalculationHistoryEntry {
	expression: string;
	result: string;
	timestamp: number;
}

/**
 * Calculator state for persistence
 */
export interface CalculatorState {
	type: CalculatorType;
	provider: string;
	value: string;
	history?: CalculationHistoryEntry[];
	providerState?: any;
}

/**
 * Calculator Provider interface
 *
 * Providers are stateless factories that create calculator implementations.
 * They describe capabilities and create configured instances.
 *
 * Not parameterized by its configuration type, matching `ITTSProvider` in
 * `@pie-players/pie-tts`. An adapter extends `CalculatorProviderConfig` and
 * narrows `createCalculator`'s argument in its own class signature — see
 * `DesmosCalculatorProviderConfig` in `@pie-players/pie-calculator-desmos` —
 * which is what gives a caller holding the concrete provider the precise type.
 * A type parameter here would add one, since a provider narrowing that argument
 * satisfies this interface either way.
 */
export interface CalculatorProvider {
	/**
	 * Unique identifier for this provider
	 */
	readonly providerId: string;

	/**
	 * Human-readable provider name
	 */
	readonly providerName: string;

	/**
	 * Supported calculator types
	 */
	readonly supportedTypes: CalculatorType[];

	/**
	 * Provider version
	 */
	readonly version: string;

	/**
	 * Initialize the provider: load the vendor library and authenticate.
	 */
	initialize(config?: CalculatorProviderInit): Promise<void>;

	/**
	 * Create a calculator instance
	 */
	createCalculator(
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	): Promise<Calculator>;

	/**
	 * Check if a calculator type is supported
	 */
	supportsType(type: CalculatorType): boolean;

	/**
	 * Clean up provider resources
	 */
	destroy(): void;

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): CalculatorProviderCapabilities;
}

/**
 * Calculator instance interface (provider-agnostic)
 *
 * The actual calculator implementation that handles calculations.
 * Created by CalculatorProvider.createCalculator()
 */
export interface Calculator {
	/**
	 * The provider that created this calculator
	 */
	readonly provider: CalculatorProvider;

	/**
	 * The calculator type
	 */
	readonly type: CalculatorType;

	/**
	 * Get current value/result
	 */
	getValue(): string;

	/**
	 * Set value
	 */
	setValue(value: string): void;

	/**
	 * Clear calculator
	 */
	clear(): void;

	/**
	 * Get calculation history (if supported)
	 */
	getHistory?(): CalculationHistoryEntry[];

	/**
	 * Clear calculation history (if supported)
	 */
	clearHistory?(): void;

	/**
	 * Evaluate an expression (if supported)
	 */
	evaluate?(expression: string): Promise<string>;

	/**
	 * Resize calculator (when container size changes)
	 */
	resize?(): void;

	/**
	 * Move keyboard focus to the primary input/expression field.
	 *
	 * Optional: providers that cannot focus an input meaningfully (e.g. a
	 * keypad-only UI without a text field) should omit or no-op. Called by
	 * host components (like the shelled calculator tool) after mount so
	 * keyboard users can begin typing immediately.
	 */
	focus?(): void;

	/**
	 * Export calculator state for persistence
	 */
	exportState(): CalculatorState;

	/**
	 * Import calculator state from persistence
	 */
	importState(state: CalculatorState): void;

	/**
	 * Destroy calculator and clean up resources
	 */
	destroy(): void;
}
