/**
 * Math.js Calculator Provider
 * Implementation of CalculatorProvider for Math.js-based calculators
 *
 * Supports: Basic and Scientific calculators
 * License: Apache 2.0 (Math.js) - Commercial-friendly, no licensing fees
 * Based on: https://mathjs.org/
 *
 * NOTE: This is a working implementation that provides basic/scientific
 * calculator functionality without requiring external licenses.
 */

import { COMMON_LIBRARIES, libraryLoader } from "../library-loader";
import type {
	CalculationHistoryEntry,
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
} from "../types";

/**
 * Math.js Calculator Provider Implementation
 */
export class MathJsCalculatorProvider implements CalculatorProvider {
	readonly providerId = "mathjs";
	readonly providerName = "Math.js";
	readonly supportedTypes: CalculatorType[] = ["basic", "scientific"];
	readonly version = "12.0.0";

	private initialized = false;

	/**
	 * Initialize Math.js library
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// SSR guard: Math.js calculators should NEVER run on the server
		if (typeof window === "undefined") {
			throw new Error(
				"Math.js calculators can only be initialized in the browser",
			);
		}

		// Load Math.js library
		await libraryLoader.loadScript(COMMON_LIBRARIES.mathjs);

		// Verify Math.js API is available
		if (!(window as any).math) {
			throw new Error("Math.js library not loaded");
		}

		this.initialized = true;
		console.log("[MathJsProvider] Initialized successfully");
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
			throw new Error(
				`Math.js provider does not support calculator type: ${type}`,
			);
		}

		return new MathJsCalculator(this, type, container, config);
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
			supportsHistory: true,
			supportsGraphing: false,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 64, // Math.js supports arbitrary precision with bignumbers
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}

/**
 * Math.js Calculator Instance
 */
class MathJsCalculator implements Calculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private math: any;
	private container: HTMLElement;
	private currentExpression = "";
	private currentValue = "0";
	private history: CalculationHistoryEntry[] = [];
	private angleMode: "deg" | "rad" = "deg"; // Default to degrees
	private memory = 0;
	private theme: "light" | "dark" | "auto" = "dark";

	// UI elements
	private displayEl?: HTMLElement;
	private historyEl?: HTMLElement;

	// Event handler references for cleanup
	private boundKeyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private buttonListeners: Array<{ element: Element; handler: EventListener }> =
		[];
	private styleElement?: HTMLStyleElement;

	constructor(
		provider: CalculatorProvider,
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	) {
		this.provider = provider;
		this.type = type;
		this.container = container;
		this.math = (window as any).math;

		// Apply config settings
		if (config?.theme) {
			this.theme = config.theme;
		}

		this._initializeCalculator();
	}

	/**
	 * Initialize calculator UI
	 */
	private _initializeCalculator(): void {
		// Create calculator structure
		this.container.innerHTML = `
      <div class="mathjs-calculator mathjs-calculator--${this.type}">
        <div class="mathjs-calculator__display-container">
          <div class="mathjs-calculator__history"></div>
          <div class="mathjs-calculator__display">0</div>
        </div>
        <div class="mathjs-calculator__buttons">
          ${this._generateButtons()}
        </div>
      </div>
    `;

		// Apply styles
		this._applyStyles();

		// Get references
		this.displayEl = this.container.querySelector(
			".mathjs-calculator__display",
		) as HTMLElement;
		this.historyEl = this.container.querySelector(
			".mathjs-calculator__history",
		) as HTMLElement;

		// Attach event listeners
		this._attachEventListeners();

		console.log(`[MathJsCalculator] Created ${this.type} calculator`);
	}

	/**
	 * Generate button layout based on calculator type
	 */
	private _generateButtons(): string {
		if (this.type === "scientific") {
			return this._generateScientificButtons();
		}
		return this._generateBasicButtons();
	}

	/**
	 * Generate basic calculator buttons
	 */
	private _generateBasicButtons(): string {
		return `
      <div class="mathjs-calculator__row">
        <button data-action="clear" class="mathjs-btn mathjs-btn--function">C</button>
        <button data-action="clearEntry" class="mathjs-btn mathjs-btn--function">CE</button>
        <button data-action="backspace" class="mathjs-btn mathjs-btn--function">⌫</button>
        <button data-input="/" class="mathjs-btn mathjs-btn--operator">÷</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-input="7" class="mathjs-btn mathjs-btn--number">7</button>
        <button data-input="8" class="mathjs-btn mathjs-btn--number">8</button>
        <button data-input="9" class="mathjs-btn mathjs-btn--number">9</button>
        <button data-input="*" class="mathjs-btn mathjs-btn--operator">×</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-input="4" class="mathjs-btn mathjs-btn--number">4</button>
        <button data-input="5" class="mathjs-btn mathjs-btn--number">5</button>
        <button data-input="6" class="mathjs-btn mathjs-btn--number">6</button>
        <button data-input="-" class="mathjs-btn mathjs-btn--operator">−</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-input="1" class="mathjs-btn mathjs-btn--number">1</button>
        <button data-input="2" class="mathjs-btn mathjs-btn--number">2</button>
        <button data-input="3" class="mathjs-btn mathjs-btn--number">3</button>
        <button data-input="+" class="mathjs-btn mathjs-btn--operator">+</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-input="0" class="mathjs-btn mathjs-btn--number mathjs-btn--wide">0</button>
        <button data-input="." class="mathjs-btn mathjs-btn--number">.</button>
        <button data-action="equals" class="mathjs-btn mathjs-btn--equals">=</button>
      </div>
    `;
	}

	/**
	 * Generate scientific calculator buttons
	 */
	private _generateScientificButtons(): string {
		return `
      <div class="mathjs-calculator__row">
        <button data-action="toggleAngle" class="mathjs-btn mathjs-btn--function" title="Toggle angle mode">DEG</button>
        <button data-action="clear" class="mathjs-btn mathjs-btn--function">C</button>
        <button data-action="clearEntry" class="mathjs-btn mathjs-btn--function">CE</button>
        <button data-action="backspace" class="mathjs-btn mathjs-btn--function">⌫</button>
        <button data-input="/" class="mathjs-btn mathjs-btn--operator">÷</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-function="sin" class="mathjs-btn mathjs-btn--function">sin</button>
        <button data-input="7" class="mathjs-btn mathjs-btn--number">7</button>
        <button data-input="8" class="mathjs-btn mathjs-btn--number">8</button>
        <button data-input="9" class="mathjs-btn mathjs-btn--number">9</button>
        <button data-input="*" class="mathjs-btn mathjs-btn--operator">×</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-function="cos" class="mathjs-btn mathjs-btn--function">cos</button>
        <button data-input="4" class="mathjs-btn mathjs-btn--number">4</button>
        <button data-input="5" class="mathjs-btn mathjs-btn--number">5</button>
        <button data-input="6" class="mathjs-btn mathjs-btn--number">6</button>
        <button data-input="-" class="mathjs-btn mathjs-btn--operator">−</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-function="tan" class="mathjs-btn mathjs-btn--function">tan</button>
        <button data-input="1" class="mathjs-btn mathjs-btn--number">1</button>
        <button data-input="2" class="mathjs-btn mathjs-btn--number">2</button>
        <button data-input="3" class="mathjs-btn mathjs-btn--number">3</button>
        <button data-input="+" class="mathjs-btn mathjs-btn--operator">+</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-function="sqrt" class="mathjs-btn mathjs-btn--function">√</button>
        <button data-input="0" class="mathjs-btn mathjs-btn--number mathjs-btn--wide">0</button>
        <button data-input="." class="mathjs-btn mathjs-btn--number">.</button>
        <button data-action="equals" class="mathjs-btn mathjs-btn--equals">=</button>
      </div>
      <div class="mathjs-calculator__row">
        <button data-function="log" class="mathjs-btn mathjs-btn--function">log</button>
        <button data-function="ln" class="mathjs-btn mathjs-btn--function">ln</button>
        <button data-function="pow" class="mathjs-btn mathjs-btn--function">x^y</button>
        <button data-input="pi" class="mathjs-btn mathjs-btn--constant">π</button>
        <button data-input="e" class="mathjs-btn mathjs-btn--constant">e</button>
      </div>
    `;
	}

	/**
	 * Apply inline styles (in production, use external stylesheet)
	 */
	private _applyStyles(): void {
		this.styleElement = document.createElement("style");

		// Theme colors
		const isDark =
			this.theme === "dark" ||
			(this.theme === "auto" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches);
		const colors = isDark
			? {
					bg: "#2c3e50",
					displayBg: "#34495e",
					text: "#ecf0f1",
					historyText: "#95a5a6",
					buttonBg: "#34495e",
				}
			: {
					bg: "#ecf0f1",
					displayBg: "#ffffff",
					text: "#2c3e50",
					historyText: "#7f8c8d",
					buttonBg: "#ffffff",
				};

		this.styleElement.textContent = `
      .mathjs-calculator {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: ${colors.bg};
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        max-width: 400px;
      }
      .mathjs-calculator__display-container {
        background: ${colors.displayBg};
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        min-height: 80px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
      }
      .mathjs-calculator__history {
        font-size: 14px;
        color: ${colors.historyText};
        text-align: right;
        min-height: 20px;
        margin-bottom: 5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mathjs-calculator__display {
        font-size: 32px;
        font-weight: 600;
        color: ${colors.text};
        text-align: right;
        word-break: break-all;
      }
      .mathjs-calculator__buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mathjs-calculator__row {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 8px;
      }
      .mathjs-calculator--basic .mathjs-calculator__row {
        grid-template-columns: repeat(4, 1fr);
      }
      .mathjs-btn {
        padding: 18px 12px;
        font-size: 18px;
        font-weight: 500;
        border: ${isDark ? "none" : "1px solid #bdc3c7"};
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        background: ${colors.buttonBg};
        color: ${colors.text};
      }
      .mathjs-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .mathjs-btn:active {
        transform: translateY(0);
      }
      .mathjs-btn--number {
        background: ${colors.buttonBg};
      }
      .mathjs-btn--operator {
        background: #e67e22;
        color: white;
      }
      .mathjs-btn--function {
        background: #3498db;
        color: white;
        font-size: 14px;
      }
      .mathjs-btn--constant {
        background: #9b59b6;
        color: white;
      }
      .mathjs-btn--equals {
        background: #27ae60;
        color: white;
      }
      .mathjs-btn--wide {
        grid-column: span 2;
      }
    `;
		this.container.appendChild(this.styleElement);
	}

	/**
	 * Attach event listeners to buttons
	 */
	private _attachEventListeners(): void {
		const buttons = this.container.querySelectorAll(".mathjs-btn");

		buttons.forEach((button) => {
			const handler = (e: Event) => {
				const target = e.currentTarget as HTMLElement;
				const input = target.dataset.input;
				const action = target.dataset.action;
				const func = target.dataset.function;

				if (input) {
					this._handleInput(input);
				} else if (action) {
					this._handleAction(action);
				} else if (func) {
					this._handleFunction(func);
				}
			};

			button.addEventListener("click", handler);
			// Store reference for cleanup
			this.buttonListeners.push({ element: button, handler });
		});

		// Keyboard support - store bound reference for cleanup
		this.boundKeyboardHandler = this._handleKeyboard.bind(this);
		document.addEventListener("keydown", this.boundKeyboardHandler);
	}

	/**
	 * Handle input button clicks
	 */
	private _handleInput(input: string): void {
		// Handle special inputs
		if (input === "pi") {
			this.currentExpression += "pi";
			this._updateDisplay();
			return;
		}
		if (input === "e") {
			this.currentExpression += "e";
			this._updateDisplay();
			return;
		}

		// Clear display if showing result
		if (this.currentValue !== "0" && this.currentExpression === "") {
			this.currentExpression = this.currentValue;
		}

		this.currentExpression += input;
		this._updateDisplay();
	}

	/**
	 * Handle action button clicks
	 */
	private _handleAction(action: string): void {
		switch (action) {
			case "clear":
				this.clear();
				break;
			case "clearEntry":
				this.currentExpression = "";
				this._updateDisplay();
				break;
			case "backspace":
				this.currentExpression = this.currentExpression.slice(0, -1);
				this._updateDisplay();
				break;
			case "equals":
				this._calculate();
				break;
			case "toggleAngle":
				this._toggleAngleMode();
				break;
		}
	}

	/**
	 * Handle function button clicks
	 */
	private _handleFunction(func: string): void {
		// Get current value or expression
		const value = this.currentExpression || this.currentValue;

		switch (func) {
			case "sin":
			case "cos":
			case "tan":
				this.currentExpression = `${func}(${value} ${this.angleMode})`;
				break;
			case "sqrt":
				this.currentExpression = `sqrt(${value})`;
				break;
			case "log":
				this.currentExpression = `log10(${value})`;
				break;
			case "ln":
				this.currentExpression = `log(${value})`;
				break;
			case "pow":
				this.currentExpression = `${value}^`;
				break;
		}

		this._updateDisplay();
	}

	/**
	 * Handle keyboard input
	 */
	private _handleKeyboard(e: KeyboardEvent): void {
		// Only handle if calculator is focused
		if (!this.container.contains(document.activeElement)) return;

		const key = e.key;

		if (/[0-9\+\-\*\/\.\(\)]/.test(key)) {
			this._handleInput(key);
		} else if (key === "Enter") {
			e.preventDefault();
			this._calculate();
		} else if (key === "Escape") {
			this.clear();
		} else if (key === "Backspace") {
			e.preventDefault();
			this.currentExpression = this.currentExpression.slice(0, -1);
			this._updateDisplay();
		}
	}

	/**
	 * Toggle angle mode (degrees/radians)
	 */
	private _toggleAngleMode(): void {
		this.angleMode = this.angleMode === "deg" ? "rad" : "deg";
		const btn = this.container.querySelector('[data-action="toggleAngle"]');
		if (btn) {
			btn.textContent = this.angleMode.toUpperCase();
		}
	}

	/**
	 * Calculate expression
	 */
	private _calculate(): void {
		if (!this.currentExpression) return;

		try {
			// Evaluate expression
			const result = this.math.evaluate(this.currentExpression);
			const resultStr = this._formatResult(result);

			// Add to history
			this.history.push({
				expression: this.currentExpression,
				result: resultStr,
				timestamp: Date.now(),
			});

			// Update display
			this.currentValue = resultStr;
			if (this.historyEl) {
				this.historyEl.textContent = this.currentExpression;
			}
			this.currentExpression = "";
			this._updateDisplay();

			console.log("[MathJsCalculator] Calculated:", this.currentValue);
		} catch (error) {
			// More descriptive error handling
			const errorMessage =
				error instanceof Error ? error.message : "Invalid expression";
			this.currentValue = "Error";
			if (this.historyEl) {
				this.historyEl.textContent = errorMessage;
			}
			this._updateDisplay();
			console.error(
				"[MathJsCalculator] Calculation error:",
				errorMessage,
				error,
			);

			// Clear error after 3 seconds
			setTimeout(() => {
				if (this.currentValue === "Error" && this.historyEl) {
					this.historyEl.textContent = "";
				}
			}, 3000);
		}
	}

	/**
	 * Format result for display
	 */
	private _formatResult(result: any): string {
		if (typeof result === "number") {
			// Round to reasonable precision
			return result.toPrecision(10).replace(/\.?0+$/, "");
		}
		return String(result);
	}

	/**
	 * Update display
	 */
	private _updateDisplay(): void {
		if (this.displayEl) {
			this.displayEl.textContent = this.currentExpression || this.currentValue;
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
		this.currentExpression = "";
		this._updateDisplay();
	}

	/**
	 * Clear calculator
	 */
	clear(): void {
		this.currentExpression = "";
		this.currentValue = "0";
		if (this.historyEl) {
			this.historyEl.textContent = "";
		}
		this._updateDisplay();
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
		if (this.historyEl) {
			this.historyEl.textContent = "";
		}
	}

	/**
	 * Evaluate expression
	 */
	async evaluate(expression: string): Promise<string> {
		try {
			const result = this.math.evaluate(expression);
			return this._formatResult(result);
		} catch (error) {
			throw new Error(`Evaluation error: ${error}`);
		}
	}

	/**
	 * Export state
	 */
	exportState(): CalculatorState {
		return {
			type: this.type,
			provider: "mathjs",
			value: this.currentValue,
			history: this.history,
			providerState: {
				expression: this.currentExpression,
				angleMode: this.angleMode,
				memory: this.memory,
			},
		};
	}

	/**
	 * Import state
	 */
	importState(state: CalculatorState): void {
		if (state.provider !== "mathjs") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		this.currentValue = state.value;
		if (state.history) {
			this.history = [...state.history];
		}

		if (state.providerState) {
			this.currentExpression = state.providerState.expression || "";
			this.angleMode = state.providerState.angleMode || "deg";
			this.memory = state.providerState.memory || 0;
		}

		this._updateDisplay();
	}

	/**
	 * Destroy calculator
	 */
	destroy(): void {
		// Remove keyboard listener (using stored bound reference)
		if (this.boundKeyboardHandler) {
			document.removeEventListener("keydown", this.boundKeyboardHandler);
			this.boundKeyboardHandler = null;
		}

		// Remove button listeners
		for (const { element, handler } of this.buttonListeners) {
			element.removeEventListener("click", handler);
		}
		this.buttonListeners = [];

		// Remove style element
		if (this.styleElement && this.styleElement.parentNode) {
			this.styleElement.parentNode.removeChild(this.styleElement);
			this.styleElement = undefined;
		}

		// Clear container using modern API
		this.container.replaceChildren();

		// Clear references
		this.displayEl = undefined;
		this.historyEl = undefined;

		console.log("[MathJsCalculator] destroyed");
	}
}

/**
 * Singleton provider instance (deprecated)
 * @deprecated Instantiate MathJsCalculatorProvider directly instead:
 *   const provider = new MathJsCalculatorProvider();
 *   await provider.initialize();
 */
export const mathjsProvider = new MathJsCalculatorProvider();
