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
 * Desmos-specific calculator configuration options
 * Based on production implementation patterns and Desmos API documentation
 */
export interface DesmosCalculatorConfig {
	// API Configuration
	// SECURITY WARNING: Never expose API keys in client-side code in production!
	// For development: Use apiKey directly
	// For production: Use proxyEndpoint to handle API key server-side
	apiKey?: string; // Desmos API key (DEVELOPMENT ONLY - obtain from https://www.desmos.com/api)
	proxyEndpoint?: string; // Server endpoint that handles Desmos API authentication (PRODUCTION RECOMMENDED)

	// Common options for all calculator types
	border?: boolean; // Show border around calculator (default: false)
	degreeMode?: boolean | "degree" | "radian"; // Angle mode: true = degrees, false = radians
	decimalToFraction?: boolean; // Enable decimal to fraction conversion
	links?: boolean; // Enable links to external Desmos resources

	// Graphing Calculator specific options
	settingsMenu?: boolean; // Show settings menu
	expressions?: boolean; // Enable expression list/editor
	zoomButtons?: boolean; // Show zoom buttons
	expressionsTopbar?: boolean; // Show expressions topbar
	notes?: boolean; // Enable notes
	folders?: boolean; // Enable folders for organizing expressions
	images?: boolean; // Enable image uploads
	qwertyKeyboard?: boolean; // Use QWERTY keyboard layout
	restrictedFunctions?: boolean; // Restrict certain functions (test mode)
	plotSingleVariableImplicitEquations?: boolean; // Enable plotting implicit equations
	distributions?: boolean; // Enable statistical distributions
	plotImplicits?: boolean; // Enable implicit equation plotting
	plotInequalities?: boolean; // Enable inequality plotting
	geometryComputationFunctions?: boolean; // Enable geometry computation functions
	sliders?: boolean; // Enable sliders for parameters
	expressionsCollapsed?: boolean; // Start with expressions collapsed
	administerSecretFolders?: boolean; // Enable secret folders
	lockViewport?: boolean; // Lock viewport (disable panning/zooming)

	// Scientific Calculator specific options
	functionDefinition?: boolean; // Enable function definition
	brailleExpressionDownload?: boolean; // Enable braille expression download

	// Basic (Four-Function) Calculator specific options
	keypad?: boolean; // Show on-screen keypad
	graphpaper?: boolean; // Show graph paper background
	additionalFunctions?: string[]; // Additional functions (e.g., ['sqrt', 'percent'])
}

/**
 * Calculator provider configuration
 */
export interface CalculatorProviderConfig {
	settings?: Record<string, any>;
	restrictedMode?: boolean; // Quick toggle for restricted/test mode (affects multiple options)
	locale?: string;
	theme?: "light" | "dark" | "auto";
	// Desmos-specific configuration
	desmos?: DesmosCalculatorConfig;
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
	 * Initialize the provider (load libraries, etc.)
	 */
	initialize(): Promise<void>;

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
