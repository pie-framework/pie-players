/**
 * Desmos Calculator Provider
 * Implementation of CalculatorProvider for Desmos calculators
 *
 * Supports: Basic, Scientific, and Graphing calculators
 * Based on Desmos API v1.12+
 * Requires: A Desmos API key when this provider loads the API from desmos.com
 *
 * Desmos's documented browser integration places the key in the calculator.js
 * URL. A runtime credential endpoint can keep the key out of source and static
 * bundles, but cannot keep it secret from a browser that loads the API.
 */

import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";

declare global {
	interface Window {
		Desmos?: any;
	}
}

export interface DesmosCalculatorProviderConfig {
	/**
	 * API key licensed for the application loading Desmos from desmos.com.
	 * Recommended for licensed deployments; the adapter retains its historical
	 * unkeyed URL when omitted so existing clients continue to initialize.
	 */
	apiKey?: string;
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

/** Desmos constructor options accepted through `CalculatorProviderConfig.settings`. */
export interface DesmosCalculatorSettings extends Record<string, unknown> {
	border?: boolean;
	degreeMode?: boolean | "degree" | "radian";
	decimalToFraction?: boolean;
	links?: boolean;
	settingsMenu?: boolean;
	expressions?: boolean;
	zoomButtons?: boolean;
	expressionsTopbar?: boolean;
	notes?: boolean;
	folders?: boolean;
	images?: boolean;
	qwertyKeyboard?: boolean;
	restrictedFunctions?: boolean;
	plotSingleVariableImplicitEquations?: boolean;
	distributions?: boolean;
	plotImplicits?: boolean;
	plotInequalities?: boolean;
	geometryComputationFunctions?: boolean;
	sliders?: boolean;
	tables?: boolean;
	expressionsCollapsed?: boolean;
	administerSecretFolders?: boolean;
	lockViewport?: boolean;
	functionDefinition?: boolean;
	brailleExpressionDownload?: boolean;
	keypad?: boolean;
	graphpaper?: boolean;
	additionalFunctions?: string | string[];
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
	readonly version = "1.12";

	private initialized = false;
	private apiKey?: string;
	private onTelemetry:
		| ((
				eventName: string,
				payload?: Record<string, unknown>,
		  ) => void | Promise<void>)
		| undefined;

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[DesmosProvider] telemetry callback failed:", error);
		}
	}

	/**
	 * Dynamically load the Desmos calculator library
	 * @private
	 */
	private async loadDesmosScript(apiKey?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			const scriptUrl = new URL(
				"https://www.desmos.com/api/v1.12/calculator.js",
			);
			if (apiKey) scriptUrl.searchParams.set("apiKey", apiKey);
			script.src = scriptUrl.toString();
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
	 * @param config Configuration with the application's Desmos API key
	 */
	async initialize(config: DesmosCalculatorProviderConfig = {}): Promise<void> {
		if (this.initialized) return;
		this.onTelemetry = config?.onTelemetry;

		// SSR guard
		if (typeof window === "undefined") {
			throw new Error(
				"Desmos calculators can only be initialized in the browser",
			);
		}

		this.apiKey = config.apiKey?.trim() || undefined;

		// Load Desmos API if not already loaded
		if (!window.Desmos) {
			if (!this.apiKey) {
				console.warn(
					"[DesmosProvider] Loading the legacy unkeyed Desmos URL for compatibility. Configure an application API key for licensed deployments.",
				);
			}
			console.log("[DesmosProvider] Loading Desmos API library...");
			const libraryLoadStartedAt = Date.now();
			await this.emitTelemetry("pie-tool-library-load-start", {
				toolId: "calculator",
				backend: "desmos",
				operation: "desmos-script-load",
			});
			try {
				await this.loadDesmosScript(this.apiKey);
				await this.emitTelemetry("pie-tool-library-load-success", {
					toolId: "calculator",
					backend: "desmos",
					operation: "desmos-script-load",
					duration: Date.now() - libraryLoadStartedAt,
				});
			} catch (error) {
				await this.emitTelemetry("pie-tool-library-load-error", {
					toolId: "calculator",
					backend: "desmos",
					operation: "desmos-script-load",
					duration: Date.now() - libraryLoadStartedAt,
					errorType: "ToolLibraryLoadError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
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

		return new DesmosCalculator(this, type, container, config);
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
		this.apiKey = undefined;
		this.onTelemetry = undefined;
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
	) {
		this.provider = provider;
		this.type = type;
		this.container = container;
		this.Desmos = window.Desmos;

		if (!this.Desmos) {
			throw new Error("Desmos API not available");
		}

		this._initializeCalculator(config);
	}

	private _initializeCalculator(config?: CalculatorProviderConfig): void {
		// Merge Desmos-specific config with defaults
		const isGraphing = this.type === "graphing";
		const desmosConfig: DesmosCalculatorSettings = {
			degreeMode: true,
			settingsMenu: isGraphing,
			qwertyKeyboard: false,
			notes: isGraphing,
			folders: isGraphing,
			sliders: isGraphing,
			tables: isGraphing,
			...(config?.settings || {}),
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

	focus(): void {
		try {
			if (
				this.type === "graphing" &&
				typeof this.calculator?.focusFirstExpression === "function"
			) {
				this.calculator.focusFirstExpression();
				return;
			}
			const target = this.container.querySelector<HTMLElement>(
				'.dcg-mq-editable-field[tabindex="0"], textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
			);
			target?.focus();
		} catch (error) {
			console.warn("[DesmosCalculator] focus() failed:", error);
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
