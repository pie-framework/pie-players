/**
 * TI Calculator Provider
 * Implementation of CalculatorProvider for TI calculator emulators
 *
 * Supports: TI-84, TI-108, TI-34 MV
 * Based on production TI calculator implementation patterns
 *
 * NOTE: Requires licensed TI emulator libraries from Texas Instruments
 */

import type {
	CalculationHistoryEntry,
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
	TICalculatorConfig,
} from "../types";

/**
 * TI Calculator library version
 * Matches version embedded in TI emulator libraries: 2.8.0.50
 * Update this when upgrading to a new version of TI emulator libraries
 */
const TI_VERSION = "v2.8.0";

// Extend Window interface for TI calculator globals
declare global {
	interface Window {
		TI_ELG_Ready?: boolean;
		TI84PCE?: new (settings: any, timeout?: number) => TICalculatorInstance;
		TI108?: new (settings: any, timeout?: number) => TICalculatorInstance;
		TI34?: new (settings: any, timeout?: number) => TICalculatorInstance;
	}
}

// TI Calculator instance interface (matches actual TI library API)
interface TICalculatorInstance {
	resize?: (options?: any) => void;
	resetEmulator?: () => void;
	killInstance?: () => boolean;
	showCalculator?: () => void;
	hideCalculator?: () => void;
	isInitialized?: () => boolean;
}

/**
 * TI Calculator Provider Implementation
 */
export class TICalculatorProvider implements CalculatorProvider {
	readonly providerId = "ti";
	readonly providerName = "Texas Instruments";
	readonly supportedTypes: CalculatorType[] = ["ti-84", "ti-108", "ti-34-mv"];
	readonly version = "1.0.0";

	private initialized = false;
	private loadedEmulators = new Set<CalculatorType>();

	/**
	 * Initialize TI emulator libraries
	 * Loads the shared ELG library that all TI calculators depend on
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// SSR guard: TI calculators should NEVER run on the server
		if (typeof window === "undefined") {
			throw new Error("TI calculators can only be initialized in the browser");
		}

		console.log("[TIProvider] Initializing TI calculator emulators...");

		// Load ELG library first (shared library for all TI calculators)
		if (!window.TI_ELG_Ready) {
			await this._loadELGLibrary();
		}

		this.initialized = true;
		console.log("[TIProvider] Initialized");
	}

	/**
	 * Load the ELG (TI Emulator Library) shared library
	 */
	private async _loadELGLibrary(): Promise<void> {
		if (window.TI_ELG_Ready) return;

		return new Promise<void>((resolve, reject) => {
			// Check if script is already loaded
			const existingScript = document.querySelector('script[src*="ELG"]');
			if (existingScript) {
				window.TI_ELG_Ready = true;
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = `/lib/ti/${TI_VERSION}/ELG-min.js`; // Versioned path for better cache control
			script.onload = () => {
				window.TI_ELG_Ready = true;
				console.log("[TIProvider] ELG library loaded successfully");
				resolve();
			};
			script.onerror = () => {
				console.error("[TIProvider] Failed to load ELG library");
				reject(
					new Error("Failed to load required TI calculator library (ELG)"),
				);
			};
			document.head.appendChild(script);
		});
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
			throw new Error(`TI Provider does not support calculator type: ${type}`);
		}

		// Load specific emulator library if not already loaded
		if (!this.loadedEmulators.has(type)) {
			await this._loadEmulator(type);
			this.loadedEmulators.add(type);
		}

		return new TICalculator(this, type, container, config);
	}

	/**
	 * Load specific TI emulator library
	 */
	private async _loadEmulator(type: CalculatorType): Promise<void> {
		console.log(`[TIProvider] Loading ${type} emulator...`);

		// Determine library files based on calculator type
		const libraryConfig = this._getLibraryConfig(type);

		// Load CSS and JS in parallel
		await Promise.all([
			this._loadScript(libraryConfig.js),
			this._loadCSS(libraryConfig.css),
		]);

		// Add a small delay to ensure everything is initialized
		await new Promise((resolve) => setTimeout(resolve, 100));

		console.log(`[TIProvider] ${type} emulator loaded successfully`);
	}

	/**
	 * Get library configuration for calculator type
	 * Uses versioned paths similar to Desmos implementation
	 */
	private _getLibraryConfig(type: CalculatorType): { js: string; css: string } {
		const basePath = `/lib/ti/${TI_VERSION}`;
		switch (type) {
			case "ti-84":
				return {
					js: `${basePath}/ti84p-min.js`,
					css: `${basePath}/css/ti84pce-min.css`,
				};
			case "ti-108":
				return {
					js: `${basePath}/ti108-min.js`,
					css: `${basePath}/css/ti108-min.css`,
				};
			case "ti-34-mv":
				return {
					js: `${basePath}/ti34mv-min.js`,
					css: `${basePath}/css/ti34mv-min.css`,
				};
			default:
				throw new Error(`Unknown TI calculator type: ${type}`);
		}
	}

	/**
	 * Load a JavaScript script
	 */
	private _loadScript(src: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// Check if script is already loaded
			if (document.querySelector(`script[src="${src}"]`)) {
				resolve();
				return;
			}

			const script = document.createElement("script");
			script.src = src;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
			document.head.appendChild(script);
		});
	}

	/**
	 * Load a CSS stylesheet
	 */
	private _loadCSS(href: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// Check if CSS is already loaded
			if (document.querySelector(`link[href="${href}"]`)) {
				resolve();
				return;
			}

			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.type = "text/css";
			link.href = href;
			link.onload = () => resolve();
			link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
			document.head.appendChild(link);
		});
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
		this.loadedEmulators.clear();
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: true,
			supportsGraphing: true, // TI-84 supports graphing
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 14, // TI calculator precision
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}

/**
 * TI Calculator Instance Implementation
 * Based on production implementation patterns
 */
class TICalculator implements Calculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private container: HTMLElement;
	private config?: CalculatorProviderConfig;
	private tiInstance: TICalculatorInstance | null = null;
	private containerId: string;
	private currentValue = "";
	private history: CalculationHistoryEntry[] = [];

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

		// Generate unique container ID for the calculator
		this.containerId = `ti-calculator-${type.replace("-", "")}-${Date.now()}`;

		// Initialize asynchronously
		this._initializeCalculator();
	}

	/**
	 * Initialize TI calculator instance
	 * Based on production implementation patterns with settings
	 */
	private async _initializeCalculator(): Promise<void> {
		console.log(`[TICalculator] Creating ${this.type} calculator`);

		// Clean up any existing container content first
		this.container.innerHTML = "";

		// Create calculator div (TI calculators require a specific div ID)
		const calculatorDiv = document.createElement("div");
		calculatorDiv.id = this.containerId;
		this.container.appendChild(calculatorDiv);

		// Verify the element is in the DOM before initializing
		// Some TI libraries (especially TI-34) querySelector immediately on initialization
		const element = document.getElementById(this.containerId);
		if (!element || !element.isConnected) {
			throw new Error(
				`Calculator container element ${this.containerId} not found in DOM`,
			);
		}

		// Get TI configuration (merge defaults with provided config)
		const tiConfig = this._getTIConfig();

		// Add a small delay to ensure DOM is ready and previous instances are cleaned up
		// Double check element still exists after delay
		await new Promise((resolve) => setTimeout(resolve, 150));

		const elementAfterDelay = document.getElementById(this.containerId);
		if (!elementAfterDelay || !elementAfterDelay.isConnected) {
			throw new Error(
				`Calculator container element ${this.containerId} was removed before initialization`,
			);
		}

		// Initialize calculator based on type
		try {
			switch (this.type) {
				case "ti-84":
					if (!window.TI84PCE) {
						throw new Error(
							"TI84PCE constructor not available. Ensure ti84p-min.js is loaded.",
						);
					}
					this.tiInstance = new window.TI84PCE(tiConfig, 60000);
					console.log(
						"[TICalculator] TI-84 calculator instance created successfully",
					);
					break;

				case "ti-108":
					if (!window.TI108) {
						throw new Error(
							"TI108 constructor not available. Ensure ti108-min.js is loaded.",
						);
					}
					this.tiInstance = new window.TI108(tiConfig, 60000);
					console.log(
						"[TICalculator] TI-108 calculator instance created successfully",
					);
					break;

				case "ti-34-mv":
					if (!window.TI34) {
						throw new Error(
							"TI34 constructor not available. Ensure ti34mv-min.js is loaded.",
						);
					}
					this.tiInstance = new window.TI34(tiConfig, 60000);
					console.log(
						"[TICalculator] TI-34MV calculator instance created successfully",
					);
					break;

				default:
					throw new Error(`Unsupported TI calculator type: ${this.type}`);
			}
		} catch (error) {
			console.error(
				`[TICalculator] Failed to initialize ${this.type} calculator:`,
				error,
			);
			// Render error message instead of crashing
			this.container.innerHTML = `
        <div style="padding: 20px; border: 2px solid #d32f2f; border-radius: 8px; background: #ffebee; text-align: center;">
          <h3 style="margin: 0 0 10px 0; color: #d32f2f;">${this._getCalculatorName()}</h3>
          <p style="margin: 0; color: #666;">
            Failed to initialize calculator.<br>
            Error: ${error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      `;
			throw error;
		}
	}

	/**
	 * Get TI configuration with defaults based on production implementation patterns
	 */
	private _getTIConfig(): any {
		const tiConfig = this.config?.ti || {};
		const defaults = this._getDefaultConfig(this.type);

		// Merge defaults with provided config
		return {
			...defaults,
			...tiConfig,
			// Ensure elementId is always set
			elementId: this.containerId,
		};
	}

	/**
	 * Get default configuration for calculator type
	 * Based on production settings with versioned paths
	 */
	private _getDefaultConfig(type: CalculatorType): TICalculatorConfig {
		const basePath = `/lib/ti/${TI_VERSION}`;
		switch (type) {
			case "ti-84":
				return {
					elementId: this.containerId,
					ROMLocation: `${basePath}/roms/No_AppsCE.h84statej`,
					FaceplateLocation: `${basePath}/faceplates/TI84CE_touch.svg`,
					KeyMappingFile: "",
					KeyHistBufferLength: "10",
					DisplayMode: "CLASSIC",
					AngleMode: "RAD",
					setTabOrder: 0,
					setScreenReaderAria: true,
					setAccessibleDisplay: true,
					setupAPIs: {
						resetEmulator: true,
					},
				};

			case "ti-108":
				return {
					elementId: this.containerId,
					ROMLocation: `${basePath}/roms/ti108.h84state`,
					FaceplateLocation: `${basePath}/faceplates/TI108_touch.svg`,
					KeyHistBufferLength: "10",
				};

			case "ti-34-mv":
				return {
					elementId: this.containerId,
					ROMLocation: `${basePath}/roms/ti34mv.h84state`,
					FaceplateLocation: `${basePath}/faceplates/TI34MV.svg`,
					KeyMappingFile: "",
					KeyHistBufferLength: "10",
					DisplayMode: "CLASSIC",
					AngleMode: "DEG",
				};

			default:
				return {
					elementId: this.containerId,
					KeyHistBufferLength: "10",
				};
		}
	}

	/**
	 * Get human-readable calculator name
	 */
	private _getCalculatorName(): string {
		switch (this.type) {
			case "ti-84":
				return "TI-84 Plus CE";
			case "ti-108":
				return "TI-108 Elementary";
			case "ti-34-mv":
				return "TI-34 MultiView";
			default:
				return "TI Calculator";
		}
	}

	/**
	 * Get current value
	 */
	getValue(): string {
		return this.currentValue;
	}

	/**
	 * Set value
	 */
	setValue(value: string): void {
		this.currentValue = value;
		console.log(`[TICalculator] setValue: ${value}`);
	}

	/**
	 * Clear calculator
	 */
	clear(): void {
		this.currentValue = "";
		console.log("[TICalculator] clear");
	}

	/**
	 * Get calculation history
	 */
	getHistory(): CalculationHistoryEntry[] {
		return [...this.history];
	}

	/**
	 * Clear history
	 */
	clearHistory(): void {
		this.history = [];
	}

	/**
	 * Evaluate expression
	 */
	async evaluate(expression: string): Promise<string> {
		console.log(`[TICalculator] evaluate: ${expression}`);

		// Stub: Simple evaluation using JavaScript
		try {
			// WARNING: This is unsafe for production - only for stub
			// eslint-disable-next-line no-eval
			const result = eval(expression.replace(/×/g, "*").replace(/÷/g, "/"));
			const resultStr = String(result);

			this.history.push({
				expression,
				result: resultStr,
				timestamp: Date.now(),
			});

			return resultStr;
		} catch (error) {
			throw new Error(`Evaluation error: ${error}`);
		}
	}

	/**
	 * Resize calculator when container dimensions change
	 */
	resize?(): void {
		// Check if the container element still exists in the DOM
		const element = document.getElementById(this.containerId);
		if (!element || !element.isConnected) {
			console.warn("[TICalculator] Cannot resize - element no longer in DOM");
			return;
		}

		try {
			if (this.tiInstance?.resize) {
				this.tiInstance.resize();
			}
			console.log("[TICalculator] resize");
		} catch (error) {
			console.warn("[TICalculator] Error during resize:", error);
		}
	}

	/**
	 * Export state
	 */
	exportState(): CalculatorState {
		return {
			type: this.type,
			provider: "ti",
			value: this.currentValue,
			history: this.history,
		};
	}

	/**
	 * Import state
	 */
	importState(state: CalculatorState): void {
		if (state.provider !== "ti") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		this.currentValue = state.value;
		if (state.history) {
			this.history = [...state.history];
		}
	}

	/**
	 * Destroy calculator
	 * Properly cleans up TI calculator instance
	 */
	destroy(): void {
		// Check if the calculator element still exists in DOM before destroying
		// The TI library's killInstance needs the element to exist and be connected
		const calculatorDiv = document.getElementById(this.containerId);
		const elementExists = calculatorDiv && calculatorDiv.isConnected;

		if (this.tiInstance?.killInstance && elementExists) {
			try {
				// Only call killInstance if element is still in DOM
				// This must be called BEFORE clearing DOM to allow library cleanup
				// For TI-34, the library may querySelector during killInstance, so element must exist
				const result = this.tiInstance.killInstance();
				console.log(
					`[TICalculator] ${this.type} calculator destroyed:`,
					result,
				);

				// Give the library time to complete cleanup operations before removing elements
				// The TI library (especially TI-34) may need to access DOM elements during cleanup
				// Use multiple requestAnimationFrame calls to ensure all async cleanup completes
				requestAnimationFrame(() => {
					// Wait one more frame to ensure all cleanup is complete
					requestAnimationFrame(() => {
						// Verify element still exists before cleaning up (library might have removed it)
						const stillExists = document.getElementById(this.containerId);
						if (stillExists || this.container.isConnected) {
							this._cleanupDOM();
						}
					});
				});
			} catch (error) {
				// If killInstance fails, log but don't throw - cleanup should continue
				console.warn(
					`[TICalculator] Error destroying ${this.type} calculator (element may already be removed):`,
					error,
				);
				// Still clean up DOM even if killInstance failed, but with a delay
				requestAnimationFrame(() => {
					// Only cleanup if container still exists
					if (this.container && this.container.isConnected) {
						this._cleanupDOM();
					}
				});
			}
		} else if (this.tiInstance?.killInstance && !elementExists) {
			console.log(
				`[TICalculator] Skipping killInstance - element no longer in DOM for ${this.type}`,
			);
			// Element already removed, just clean up references
			this._cleanupDOM();
		} else {
			// No instance to destroy, just clean up DOM
			this._cleanupDOM();
		}

		this.tiInstance = null;
		console.log("[TICalculator] destroyed");
	}

	/**
	 * Internal method to clean up DOM elements
	 * Called after killInstance completes to prevent library accessing removed elements
	 * Note: Only clears the specific calculator div, not the entire container
	 * The container persists and can be reused when switching between TI calculators
	 */
	private _cleanupDOM(): void {
		// Get reference to calculator div before cleaning up
		// Only clear the specific calculator div with our containerId, not the entire container
		// This allows the container to be reused when switching calculator types
		const calculatorDiv = document.getElementById(this.containerId);

		// Clean up only the calculator div with our specific ID
		// Don't clear the entire container - it may be reused for a new calculator
		if (calculatorDiv) {
			try {
				// Check if still connected and matches our containerId before clearing
				if (
					calculatorDiv.isConnected &&
					calculatorDiv.id === this.containerId
				) {
					// Clear only this calculator div's children
					calculatorDiv.replaceChildren();
				}
			} catch (error) {
				console.warn("[TICalculator] Error clearing calculator div:", error);
			}
		}

		// Note: We intentionally don't clear this.container here
		// The container is managed by the tool-calculator component and may be reused
		// for a new calculator instance. Only clear the specific calculator div above.
	}
}

/**
 * Singleton provider instance (deprecated)
 * @deprecated Instantiate TICalculatorProvider directly instead:
 *   const provider = new TICalculatorProvider();
 *   await provider.initialize();
 */
export const tiProvider = new TICalculatorProvider();

/**
 * NOTE: TI Calculator Emulator Integration
 *
 * To complete this implementation, you need:
 *
 * 1. Licensed TI Emulator Libraries:
 *    - TI-84 Plus CE Emulator SDK
 *    - TI-108 Emulator SDK
 *    - TI-34 MultiView Emulator SDK
 *
 * 2. API Documentation:
 *    - Initialize emulator in iframe or container
 *    - Send keypress events
 *    - Read display state
 *    - Export/import calculator memory
 *
 * 3. Licensing:
 *    - Obtain appropriate licenses from Texas Instruments
 *    - Comply with TI's terms of service
 *    - May require per-student or site licenses
 *
 * 4. References:
 *    - Various assessment platforms use TI emulators via Learnosity
 *    - Production implementations exist with TI emulator support
 *    - Some platforms use only Desmos calculators
 *
 * 5. Alternative Approach:
 *    - Embed TI emulator iframes from TI Education
 *    - Use postMessage API for communication
 *    - Handle cross-origin restrictions
 *
 * For now, this stub allows the architecture to support TI calculators
 * without blocking development of other features.
 */
