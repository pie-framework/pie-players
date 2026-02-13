/**
 * Desmos Calculator Provider
 * Implementation of CalculatorProvider for Desmos calculators
 *
 * Supports: Basic, Scientific, and Graphing calculators
 * Based on Desmos API v1.10+
 * Requires: Desmos API key (obtain from https://www.desmos.com/api)
 *
 * SECURITY BEST PRACTICE:
 * - Development: Pass apiKey directly for local testing
 * - Production: Use proxyEndpoint to keep API key server-side
 *
 * Example server-side proxy (Express.js):
 * ```
 * app.get('/api/desmos/token', requireAuth, (req, res) => {
 *   res.json({ apiKey: process.env.DESMOS_API_KEY });
 * });
 * ```
 */

import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
	DesmosCalculatorConfig,
} from "@pie-players/pie-calculator";

declare global {
	interface Window {
		Desmos?: any;
	}
}

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
	private proxyEndpoint?: string;
	private isDevelopment = false;

	/**
	 * Get the configured API key
	 * @internal Used internally by calculator instances
	 */
	getApiKey(): string | undefined {
		return this.apiKey;
	}

	/**
	 * Dynamically load the Desmos calculator library
	 * @private
	 */
	private async loadDesmosScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			// Include API key in script URL if available
			const scriptUrl = this.apiKey
				? `https://www.desmos.com/api/v1.10/calculator.js?apiKey=${this.apiKey}`
				: "https://www.desmos.com/api/v1.10/calculator.js";
			script.src = scriptUrl;
			script.async = true;
			script.onload = () => {
				if (window.Desmos) {
					console.log("[DesmosProvider] Desmos API loaded successfully");
					resolve();
				} else {
					reject(new Error("Desmos API loaded but window.Desmos is undefined"));
				}
			};
			script.onerror = () => {
				reject(new Error("Failed to load Desmos API from CDN"));
			};
			document.head.appendChild(script);
		});
	}

	/**
	 * Initialize Desmos library
	 * @param config Configuration with API key (development) or proxy endpoint (production)
	 */
	async initialize(config?: {
		apiKey?: string;
		proxyEndpoint?: string;
	}): Promise<void> {
		if (this.initialized) return;

		// SSR guard
		if (typeof window === "undefined") {
			throw new Error(
				"Desmos calculators can only be initialized in the browser",
			);
		}

		// Determine if we're in development mode
		this.isDevelopment =
			process.env.NODE_ENV === "development" ||
			typeof process === "undefined" ||
			!process.env.NODE_ENV;

		// Configure API access pattern
		if (config?.proxyEndpoint) {
			// Production pattern: server-side proxy
			this.proxyEndpoint = config.proxyEndpoint;
			try {
				const response = await fetch(config.proxyEndpoint);
				if (!response.ok) {
					throw new Error(`Proxy endpoint returned ${response.status}`);
				}
				const data = await response.json();
				this.apiKey = data.apiKey;
				console.log(
					"[DesmosProvider] Initialized with server-side proxy (SECURE)",
				);
			} catch (error) {
				throw new Error(
					`[DesmosProvider] Failed to fetch API key from proxy: ${error}`,
				);
			}
		} else if (config?.apiKey) {
			// Development pattern: direct API key
			this.apiKey = config.apiKey;

			// Security warning in production
			if (!this.isDevelopment) {
				console.error(
					"⚠️ [DesmosProvider] SECURITY WARNING: API key exposed in client-side code!\n" +
						"This is insecure for production. Use proxyEndpoint instead.\n" +
						"See: https://pie-players.dev/docs/calculator-desmos#security",
				);
			} else {
				console.log(
					"[DesmosProvider] Initialized with direct API key (DEVELOPMENT MODE)",
				);
			}
		} else {
			// No API key provided
			console.warn(
				"[DesmosProvider] No API key or proxy endpoint provided.\n" +
					"Production usage requires authentication. Obtain API key from https://www.desmos.com/api\n" +
					"Recommended: Use proxyEndpoint for production, apiKey for development only.",
			);
		}

		// Load Desmos API if not already loaded
		if (!window.Desmos) {
			console.log("[DesmosProvider] Loading Desmos API library...");
			await this.loadDesmosScript();
		}

		this.initialized = true;
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

		return new DesmosCalculator(this, type, container, config, this.apiKey);
	}

	/**
	 * Check if type is supported
	 */
	supportsType(type: CalculatorType): boolean {
		return this.supportedTypes.includes(type);
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.initialized = false;
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: false, // Desmos doesn't expose history API
			supportsGraphing: true,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 15,
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

	private Desmos: any;
	private calculator: any;
	private container: HTMLElement;

	constructor(
		provider: CalculatorProvider,
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
		apiKey?: string,
	) {
		this.provider = provider;
		this.type = type;
		this.container = container;
		this.Desmos = window.Desmos;

		if (!this.Desmos) {
			throw new Error("Desmos API not available");
		}

		this._initializeCalculator(config, apiKey);
	}

	private _initializeCalculator(
		config?: CalculatorProviderConfig,
		apiKey?: string,
	): void {
		// Merge Desmos-specific config with defaults
		const desmosConfig: DesmosCalculatorConfig = {
			...(config?.desmos || {}),
			apiKey: apiKey || config?.desmos?.apiKey,
		};

		// Apply restricted mode if specified
		if (config?.restrictedMode) {
			Object.assign(desmosConfig, {
				expressionsTopbar: false,
				settingsMenu: false,
				zoomButtons: false,
				expressions: false,
				links: false,
			});
		}

		// Create appropriate calculator type
		switch (this.type) {
			case "graphing":
				this.calculator = this.Desmos.GraphingCalculator(
					this.container,
					desmosConfig,
				);
				break;
			case "scientific":
				this.calculator = this.Desmos.ScientificCalculator(
					this.container,
					desmosConfig,
				);
				break;
			case "basic":
				this.calculator = this.Desmos.FourFunctionCalculator(
					this.container,
					desmosConfig,
				);
				break;
			default:
				throw new Error(`Unsupported calculator type: ${this.type}`);
		}

		console.log(`[DesmosCalculator] Created ${this.type} calculator`);
	}

	getValue(): string {
		// For graphing calculator, get the state
		if (this.type === "graphing" && this.calculator.getState) {
			const state = this.calculator.getState();
			return JSON.stringify(state);
		}
		// For other calculators, return empty (Desmos doesn't expose value API)
		return "";
	}

	setValue(value: string): void {
		// For graphing calculator, set the state
		if (this.type === "graphing" && this.calculator.setState) {
			try {
				const state = JSON.parse(value);
				this.calculator.setState(state);
			} catch (error) {
				console.error("[DesmosCalculator] Failed to set state:", error);
			}
		}
	}

	clear(): void {
		if (this.calculator.setBlank) {
			this.calculator.setBlank();
		}
	}

	async evaluate(expression: string): Promise<string> {
		// Desmos doesn't provide a direct evaluate API
		// For graphing calculator, add expression and observe
		if (this.type === "graphing") {
			return new Promise((resolve) => {
				const id = `eval_${Date.now()}`;
				this.calculator.setExpression({ id, latex: expression });

				// Give Desmos time to process
				setTimeout(() => {
					const helperExpression = this.calculator.HelperExpression({
						latex: expression,
					});
					const result = helperExpression.numericValue || expression;
					this.calculator.removeExpression({ id });
					resolve(String(result));
				}, 100);
			});
		}
		return expression;
	}

	resize(): void {
		if (this.calculator.resize) {
			this.calculator.resize();
		}
	}

	exportState(): CalculatorState {
		let providerState: any = {};

		if (this.type === "graphing" && this.calculator.getState) {
			providerState = this.calculator.getState();
		}

		return {
			type: this.type,
			provider: "desmos",
			value: this.getValue(),
			providerState,
		};
	}

	importState(state: CalculatorState): void {
		if (state.provider !== "desmos") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		if (state.providerState && this.calculator.setState) {
			this.calculator.setState(state.providerState);
		} else if (state.value) {
			this.setValue(state.value);
		}
	}

	destroy(): void {
		if (this.calculator && this.calculator.destroy) {
			this.calculator.destroy();
		}
		this.container.replaceChildren();
		console.log("[DesmosCalculator] destroyed");
	}
}
