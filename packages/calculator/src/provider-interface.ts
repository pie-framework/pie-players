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
 * Calculator provider configuration
 */
export interface CalculatorProviderConfig {
	settings?: Record<string, any>;
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
 * `TConfig` lets an adapter declare the per-instance configuration it accepts —
 * see `DesmosCalculatorProviderConfig` in `@pie-players/pie-calculator-desmos`.
 * It types `createCalculator`'s argument for callers holding the concrete
 * provider type; it is not an assignability constraint, since a provider
 * narrowing that parameter still satisfies `CalculatorProvider`.
 */
export interface CalculatorProvider<
	TConfig extends CalculatorProviderConfig = CalculatorProviderConfig,
> {
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
	 * Initialize the provider (load libraries, etc.)
	 */
	initialize(): Promise<void>;

	/**
	 * Create a calculator instance
	 */
	createCalculator(
		type: CalculatorType,
		container: HTMLElement,
		config?: TConfig,
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
