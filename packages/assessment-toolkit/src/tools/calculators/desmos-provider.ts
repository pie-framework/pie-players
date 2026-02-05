/**
 * Desmos Calculator Provider
 * Implementation of CalculatorProvider for Desmos calculators
 *
 * Supports: Basic, Scientific, and Graphing calculators
 * Based on Desmos API v1.10+
 */

import type {
	CalculationHistoryEntry,
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
	DesmosCalculatorConfig,
} from "@pie-players/pie-calculator";
import { COMMON_LIBRARIES, libraryLoader } from "../library-loader";

/**
 * Desmos Calculator Provider Implementation
 */
export class DesmosCalculatorProvider implements CalculatorProvider {
	readonly providerId = "desmos";
	readonly providerName = "Desmos";
	readonly supportedTypes: CalculatorType[] = [
		"basic",
		"scientific",
		"graphing",
	];
	readonly version = "1.10";

	private initialized = false;
	private apiKey?: string;

	/**
	 * Get the configured API key
	 */
	getApiKey(): string | undefined {
		return this.apiKey;
	}

	/**
	 * Initialize Desmos library
	 * @param config Optional configuration including API key
	 */
	async initialize(config?: { apiKey?: string }): Promise<void> {
		if (this.initialized) return;

		// SSR guard: Desmos calculators should NEVER run on the server
		if (typeof window === "undefined") {
			throw new Error(
				"Desmos calculators can only be initialized in the browser",
			);
		}

		// Store API key from config, environment variable, or global
		this.apiKey =
			config?.apiKey ||
			(typeof process !== "undefined" && process.env?.DESMOS_API_KEY) ||
			(typeof window !== "undefined" && (window as any).PIE_DESMOS_API_KEY);

		// Warn if no API key is provided (production usage requires it)
		if (!this.apiKey) {
			console.warn(
				"[DesmosProvider] No API key provided. Production usage requires a Desmos API key. " +
					"Obtain one from https://www.desmos.com/api or contact partnerships@desmos.com",
			);
		}

		// Load Desmos library
		await libraryLoader.loadScript(COMMON_LIBRARIES.desmos);

		// Verify Desmos API is available
		if (!(window as any).Desmos) {
			throw new Error("Desmos API not loaded");
		}

		this.initialized = true;
		console.log(
			`[DesmosProvider] Initialized successfully${this.apiKey ? " with API key" : " (no API key)"}`,
		);
	}

	/**
	 * Create a calculator instance
	 */
	async createCalculator(
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	): Promise<Calculator> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.supportsType(type)) {
			throw new Error(`Desmos does not support calculator type: ${type}`);
		}

		return new DesmosCalculator(this, type, container, config);
	}

	/**
	 * Check if type is supported
	 */
	supportsType(type: CalculatorType): boolean {
		return this.supportedTypes.includes(type);
	}

	/**
	 * Cleanup (no-op for Desmos)
	 */
	destroy(): void {
		// Desmos doesn't require global cleanup
		this.initialized = false;
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: true,
			supportsGraphing: true,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 15, // JavaScript number precision
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}

/**
 * Desmos Calculator Instance
 */
class DesmosCalculator implements Calculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private desmosCalculator: any;
	private container: HTMLElement;
	private config?: CalculatorProviderConfig;

	constructor(
		provider: CalculatorProvider,
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	) {
		this.provider = provider;
		this.type = type;
		this.container = container;
		this.config = config;

		this._initializeCalculator();
	}

	/**
	 * Initialize Desmos calculator instance
	 * Based on production implementation patterns
	 */
	private _initializeCalculator(): void {
		const Desmos = (window as any).Desmos;

		// Get Desmos-specific config or empty object
		const desmosConfig = this.config?.desmos || {};

		// Determine API key (config overrides provider-level)
		const apiKey =
			desmosConfig.apiKey ||
			(this.provider as DesmosCalculatorProvider).getApiKey();

		// Apply restricted mode defaults if enabled
		const restrictedDefaults = this._getRestrictedModeDefaults();

		// Merge order: type-specific defaults < restricted mode defaults < explicit config
		// This ensures explicit config can override restricted mode when needed
		const options = {
			...this._getTypeSpecificDefaults(),
			...restrictedDefaults,
			...desmosConfig,
			...this._mapConfigToDesmos(this.config),
		};

		// Add API key if available
		if (apiKey) {
			options.apiKey = apiKey;
		}

		// Create appropriate calculator type
		switch (this.type) {
			case "basic":
				this.desmosCalculator = Desmos.FourFunctionCalculator(
					this.container,
					options,
				);
				break;
			case "scientific":
				this.desmosCalculator = Desmos.ScientificCalculator(
					this.container,
					options,
				);
				break;
			case "graphing":
				this.desmosCalculator = Desmos.GraphingCalculator(
					this.container,
					options,
				);
				break;
			default:
				throw new Error(`Unknown Desmos calculator type: ${this.type}`);
		}

		console.log(
			`[DesmosCalculator] Created ${this.type} calculator with options:`,
			options,
		);
	}

	/**
	 * Get type-specific default options
	 */
	private _getTypeSpecificDefaults(): any {
		const defaults: any = {
			border: false, // No border around calculator (production implementation pattern)
		};

		switch (this.type) {
			case "basic":
				// Basic calculator: no keypad, no graph paper (just the calculator itself)
				// Matches production FourFunctionCalculator setup
				defaults.keypad = false;
				defaults.graphpaper = false;
				break;
			case "scientific":
				// Scientific calculator: minimal defaults, mostly controlled by config
				break;
			case "graphing":
				// Graphing calculator: enable expressions, zoom buttons, topbar by default
				defaults.expressions = true;
				defaults.zoomButtons = true;
				defaults.expressionsTopbar = true;
				defaults.settingsMenu = true;
				defaults.notes = true;
				defaults.folders = true;
				defaults.images = false; // Images disabled by default (production pattern)
				break;
		}

		return defaults;
	}

	/**
	 * Get restricted mode defaults (test mode options)
	 * Based on production test mode configuration
	 */
	private _getRestrictedModeDefaults(): any {
		if (!this.config?.restrictedMode) {
			return {};
		}

		// Restricted mode defaults based on production test mode settings
		const restricted: any = {
			border: false,
			links: false,
			qwertyKeyboard: true,
			degreeMode: true,
			decimalToFraction: true,
		};

		// Type-specific restricted mode options
		if (this.type === "graphing") {
			Object.assign(restricted, {
				images: false,
				folders: false,
				notes: false,
				restrictedFunctions: true,
				plotSingleVariableImplicitEquations: false,
				plotImplicits: false,
				plotInequalities: false,
				sliders: false,
				settingsMenu: false,
				zoomButtons: false,
				geometryComputationFunctions: true,
				distributions: true,
			});
		} else if (this.type === "scientific") {
			Object.assign(restricted, {
				functionDefinition: false,
				brailleExpressionDownload: false,
			});
		}

		return restricted;
	}

	/**
	 * Map provider config to Desmos options
	 * Legacy mapping for backwards compatibility
	 */
	private _mapConfigToDesmos(config?: CalculatorProviderConfig): any {
		if (!config) return {};

		const desmosOptions: any = {};

		// Map locale to Desmos language option
		if (config.locale) {
			desmosOptions.language = config.locale;
		}

		// Theme mapping (Desmos may support this via CSS, not API)
		// Note: Desmos doesn't have a theme option in the API, but we keep this
		// for potential future use or CSS-based theming

		return desmosOptions;
	}

	/**
	 * Get current value/expression
	 */
	getValue(): string {
		// For graphing calculator, get all expressions
		if (this.type === "graphing") {
			const state = this.desmosCalculator.getState();
			return JSON.stringify(state.expressions.list);
		}

		// For basic/scientific, get current expression
		const state = this.desmosCalculator.getState();
		return state.expression || "";
	}

	/**
	 * Set value/expression
	 */
	setValue(value: string): void {
		if (this.type === "graphing") {
			try {
				const expressions = JSON.parse(value);
				this.desmosCalculator.setState({ expressions: { list: expressions } });
			} catch (error) {
				console.error("[DesmosCalculator] Invalid expression format:", error);
			}
		} else {
			// Basic/Scientific calculators
			this.desmosCalculator.setExpression({ latex: value });
		}
	}

	/**
	 * Clear calculator
	 */
	clear(): void {
		if (this.type === "graphing") {
			this.desmosCalculator.setBlank();
		} else {
			this.setValue("");
		}
	}

	/**
	 * Get calculation history (not natively supported by Desmos)
	 */
	getHistory(): CalculationHistoryEntry[] {
		// Desmos doesn't provide history natively
		// Would need to implement custom tracking
		return [];
	}

	/**
	 * Clear history
	 */
	clearHistory(): void {
		// No-op - Desmos doesn't have history
	}

	/**
	 * Resize calculator when container dimensions change
	 * Matches production pattern: calculatorInstance.resize()
	 */
	resize(): void {
		if (
			this.desmosCalculator &&
			typeof this.desmosCalculator.resize === "function"
		) {
			this.desmosCalculator.resize();
		}
	}

	/**
	 * Evaluate expression (for graphing calculator)
	 */
	async evaluate(expression: string): Promise<string> {
		return new Promise((resolve, reject) => {
			try {
				// Set expression and wait for computation
				this.desmosCalculator.setExpression({ latex: expression });

				// For basic math, Desmos evaluates automatically
				// Get the result from state
				setTimeout(() => {
					const result = this.getValue();
					resolve(result);
				}, 100); // Small delay for Desmos to compute
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Export calculator state
	 */
	exportState(): CalculatorState {
		const state = this.desmosCalculator.getState();

		return {
			type: this.type,
			provider: "desmos",
			value: this.getValue(),
			providerState: state,
		};
	}

	/**
	 * Import calculator state
	 */
	importState(state: CalculatorState): void {
		if (state.provider !== "desmos") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		if (state.providerState) {
			this.desmosCalculator.setState(state.providerState);
		} else if (state.value) {
			this.setValue(state.value);
		}
	}

	/**
	 * Destroy calculator
	 */
	destroy(): void {
		if (this.desmosCalculator) {
			try {
				this.desmosCalculator.destroy();
			} catch (error) {
				console.warn("[DesmosCalculator] Error during destroy:", error);
			}
			this.desmosCalculator = null;
		}

		// Clear the container to ensure Desmos releases all references
		if (this.container) {
			// Remove any Desmos-specific attributes
			this.container.removeAttribute("data-desmos-id");

			// Use modern API - more efficient and cleaner
			this.container.replaceChildren();
		}
	}
}

/**
 * Singleton provider instance (deprecated)
 * @deprecated Instantiate DesmosCalculatorProvider directly instead:
 *   const provider = new DesmosCalculatorProvider();
 *   await provider.initialize();
 */
export const desmosProvider = new DesmosCalculatorProvider();
