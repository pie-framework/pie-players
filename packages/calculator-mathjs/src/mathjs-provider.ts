/**
 * Math.js Calculator Provider
 * Professional implementation with WCAG 2.2 Level AA accessibility
 *
 * Features:
 * - DaisyUI theming for consistent UI
 * - ARIA grid navigation pattern
 * - Screen reader announcements
 * - Keyboard shortcuts (industry standard)
 * - Touch-friendly buttons (48x48px)
 * - High contrast mode support
 * - Focus management
 *
 * Supports: Basic and Scientific calculators
 * License: Apache 2.0 (Math.js) - Commercial-friendly, no licensing fees
 * Based on: https://mathjs.org/
 */

import type {
	CalculationHistoryEntry,
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";

declare global {
	interface Window {
		math?: any;
	}
}

/**
 * Math.js Calculator Provider Implementation
 */
export class MathJsCalculatorProvider implements CalculatorProvider {
	readonly providerId = "mathjs";
	readonly providerName = "Math.js";
	readonly supportedTypes: CalculatorType[] = ["basic", "scientific"];
	readonly version = "12.0.0";

	private initialized = false;

	async initialize(): Promise<void> {
		if (this.initialized) return;

		// SSR guard
		if (typeof window === "undefined") {
			throw new Error(
				"Math.js calculators can only be initialized in the browser",
			);
		}

		// Check if math.js is available
		if (!window.math) {
			throw new Error(
				"Math.js library not found. Please load math.js before initializing the calculator provider.",
			);
		}

		this.initialized = true;
		console.log("[MathJsProvider] Initialized successfully");
	}

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

	supportsType(type: CalculatorType): boolean {
		return this.supportedTypes.includes(type);
	}

	destroy(): void {
		this.initialized = false;
	}

	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: true,
			supportsGraphing: false,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 64,
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}

/**
 * Math.js Calculator Instance
 * Professional implementation with full accessibility support
 */
class MathJsCalculator implements Calculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private math: any;
	private container: HTMLElement;
	private currentExpression = "";
	private currentValue = "0";
	private history: CalculationHistoryEntry[] = [];
	private angleMode: "deg" | "rad" = "deg";
	private memory = 0;
	private theme: "light" | "dark" | "auto" = "light";

	// UI elements
	private displayEl?: HTMLInputElement;
	private historyEl?: HTMLElement;
	private statusEl?: HTMLElement;
	private errorEl?: HTMLElement;
	private gridEl?: HTMLElement;

	// Navigation state
	private currentRow = 0;
	private currentCol = 0;
	private grid: HTMLElement[][] = [];

	// Event handlers
	private boundKeyboardHandler: ((e: KeyboardEvent) => void) | null = null;
	private boundGridNavHandler: ((e: KeyboardEvent) => void) | null = null;
	private buttonListeners: Array<{ element: Element; handler: EventListener }> =
		[];

	constructor(
		provider: CalculatorProvider,
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	) {
		this.provider = provider;
		this.type = type;
		this.container = container;
		this.math = window.math;

		if (!this.math) {
			throw new Error("Math.js not available");
		}

		if (config?.theme) {
			this.theme = config.theme;
		}

		this._initializeCalculator();
	}

	/**
	 * Initialize calculator UI with DaisyUI components
	 */
	private _initializeCalculator(): void {
		this.container.innerHTML = `
      <div
        class="calculator-mathjs card bg-base-100 shadow-xl w-full max-w-md"
        data-theme="${this.theme}"
        role="dialog"
        aria-label="${this.type === "scientific" ? "Scientific" : "Basic"} Calculator"
        aria-describedby="calc-instructions-${this._generateId()}"
      >
        <!-- Screen reader instructions -->
        <div id="calc-instructions-${this._generateId()}" class="sr-only">
          Use arrow keys to navigate between buttons.
          Press Enter or Space to activate a button.
          Type numbers and operators directly to perform calculations.
        </div>

        <!-- Calculator header -->
        <div class="card-header bg-primary text-primary-content p-4 rounded-t-2xl">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-bold">
              ${this.type === "scientific" ? "Scientific" : "Basic"} Calculator
            </h2>
            ${
							this.type === "scientific"
								? `
              <button
                class="btn btn-ghost btn-sm btn-circle"
                aria-label="Toggle angle mode. Current mode: ${this.angleMode === "deg" ? "degrees" : "radians"}"
                data-action="toggleAngle"
              >
                <span class="text-sm font-mono">${this.angleMode.toUpperCase()}</span>
              </button>
            `
								: ""
						}
          </div>
        </div>

        <!-- Calculator display -->
        <div class="calculator-display bg-base-200 p-6" role="region" aria-label="Calculator display">
          <!-- History line -->
          <div
            role="log"
            aria-live="polite"
            aria-label="Calculation history"
            class="calculator-history text-sm opacity-60 font-mono text-right min-h-6 mb-2"
          >
          </div>

          <!-- Main display -->
          <input
            type="text"
            role="textbox"
            aria-label="Calculator display"
            aria-live="assertive"
            aria-atomic="true"
            readonly
            value="0"
            class="calculator-display-input input w-full text-4xl font-mono text-right bg-transparent border-none focus:outline-none p-0"
          />
        </div>

        <!-- Error display -->
        <div
          role="alert"
          aria-live="assertive"
          class="calculator-error alert alert-error mx-4 mt-4 hidden"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="calculator-error-message"></span>
        </div>

        <!-- Calculator buttons -->
        <div class="card-body p-4">
          ${this._generateButtons()}
        </div>

        <!-- Screen reader announcements -->
        <div class="sr-only" aria-live="polite" aria-atomic="true" id="calc-status-${this._generateId()}"></div>
      </div>
    `;

		this._applyStyles();
		this._cacheElements();
		this._attachEventListeners();
		this._buildGrid();
	}

	private _generateId(): string {
		return Math.random().toString(36).substring(2, 11);
	}

	private _generateButtons(): string {
		if (this.type === "scientific") {
			return this._generateScientificButtons();
		}
		return this._generateBasicButtons();
	}

	private _generateBasicButtons(): string {
		return `
      <!-- Memory functions -->
      <div role="group" aria-label="Memory functions" class="flex gap-2 mb-4">
        <button
          class="btn btn-sm flex-1 btn-ghost"
          data-action="memoryClear"
          aria-label="Memory clear"
        >
          MC
        </button>
        <button
          class="btn btn-sm flex-1 btn-ghost"
          data-action="memoryRecall"
          aria-label="Memory recall"
          aria-disabled="true"
          disabled
        >
          MR
        </button>
        <button
          class="btn btn-sm flex-1 btn-ghost"
          data-action="memoryAdd"
          aria-label="Memory add"
        >
          M+
        </button>
        <button
          class="btn btn-sm flex-1 btn-ghost"
          data-action="memorySubtract"
          aria-label="Memory subtract"
        >
          M-
        </button>
      </div>

      <!-- Main calculator grid -->
      <div
        role="grid"
        aria-label="Calculator buttons"
        tabindex="0"
        class="calculator-grid"
      >
        <!-- Row 1 -->
        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button
            role="gridcell"
            class="btn btn-square btn-lg btn-error"
            data-action="clear"
            aria-label="All clear"
          >
            AC
          </button>
          <button
            role="gridcell"
            class="btn btn-square btn-lg btn-warning"
            data-action="plusMinus"
            aria-label="Plus minus"
          >
            ±
          </button>
          <button
            role="gridcell"
            class="btn btn-square btn-lg btn-warning"
            data-input="%"
            aria-label="Percent"
          >
            %
          </button>
          <button
            role="gridcell"
            class="btn btn-square btn-lg btn-primary"
            data-input="/"
            aria-label="Divide"
          >
            ÷
          </button>
        </div>

        <!-- Row 2 -->
        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="7" aria-label="Seven">7</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="8" aria-label="Eight">8</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="9" aria-label="Nine">9</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="*" aria-label="Multiply">×</button>
        </div>

        <!-- Row 3 -->
        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="4" aria-label="Four">4</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="5" aria-label="Five">5</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="6" aria-label="Six">6</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="-" aria-label="Subtract">−</button>
        </div>

        <!-- Row 4 -->
        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="1" aria-label="One">1</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="2" aria-label="Two">2</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="3" aria-label="Three">3</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="+" aria-label="Add">+</button>
        </div>

        <!-- Row 5 -->
        <div role="row" class="grid grid-cols-4 gap-2">
          <button role="gridcell" class="btn btn-square btn-lg col-span-2" data-input="0" aria-label="Zero">0</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="." aria-label="Decimal point">.</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-success" data-action="equals" aria-label="Equals">=</button>
        </div>
      </div>
    `;
	}

	private _generateScientificButtons(): string {
		return `
      <!-- Memory functions -->
      <div role="group" aria-label="Memory functions" class="flex gap-2 mb-4">
        <button class="btn btn-sm flex-1 btn-ghost" data-action="memoryClear" aria-label="Memory clear">MC</button>
        <button class="btn btn-sm flex-1 btn-ghost" data-action="memoryRecall" aria-label="Memory recall" disabled>MR</button>
        <button class="btn btn-sm flex-1 btn-ghost" data-action="memoryAdd" aria-label="Memory add">M+</button>
        <button class="btn btn-sm flex-1 btn-ghost" data-action="memorySubtract" aria-label="Memory subtract">M-</button>
      </div>

      <!-- Scientific functions -->
      <div role="group" aria-label="Scientific functions" class="grid grid-cols-5 gap-2 mb-4">
        <button class="btn btn-sm btn-ghost" data-function="sin" aria-label="Sine">sin</button>
        <button class="btn btn-sm btn-ghost" data-function="cos" aria-label="Cosine">cos</button>
        <button class="btn btn-sm btn-ghost" data-function="tan" aria-label="Tangent">tan</button>
        <button class="btn btn-sm btn-ghost" data-function="sqrt" aria-label="Square root">√</button>
        <button class="btn btn-sm btn-ghost" data-function="pow" aria-label="Power">x^y</button>
        <button class="btn btn-sm btn-ghost" data-function="log" aria-label="Logarithm base 10">log</button>
        <button class="btn btn-sm btn-ghost" data-function="ln" aria-label="Natural logarithm">ln</button>
        <button class="btn btn-sm btn-ghost" data-input="(" aria-label="Open parenthesis">(</button>
        <button class="btn btn-sm btn-ghost" data-input=")" aria-label="Close parenthesis">)</button>
        <button class="btn btn-sm btn-ghost" data-input="pi" aria-label="Pi">π</button>
      </div>

      <!-- Main calculator grid -->
      <div
        role="grid"
        aria-label="Calculator buttons"
        tabindex="0"
        class="calculator-grid"
      >
        <!-- Row 1 -->
        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg btn-error" data-action="clear" aria-label="All clear">AC</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-warning" data-action="plusMinus" aria-label="Plus minus">±</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-warning" data-input="%" aria-label="Percent">%</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="/" aria-label="Divide">÷</button>
        </div>

        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="7" aria-label="Seven">7</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="8" aria-label="Eight">8</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="9" aria-label="Nine">9</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="*" aria-label="Multiply">×</button>
        </div>

        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="4" aria-label="Four">4</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="5" aria-label="Five">5</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="6" aria-label="Six">6</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="-" aria-label="Subtract">−</button>
        </div>

        <div role="row" class="grid grid-cols-4 gap-2 mb-2">
          <button role="gridcell" class="btn btn-square btn-lg" data-input="1" aria-label="One">1</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="2" aria-label="Two">2</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="3" aria-label="Three">3</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-primary" data-input="+" aria-label="Add">+</button>
        </div>

        <div role="row" class="grid grid-cols-4 gap-2">
          <button role="gridcell" class="btn btn-square btn-lg col-span-2" data-input="0" aria-label="Zero">0</button>
          <button role="gridcell" class="btn btn-square btn-lg" data-input="." aria-label="Decimal point">.</button>
          <button role="gridcell" class="btn btn-square btn-lg btn-success" data-action="equals" aria-label="Equals">=</button>
        </div>
      </div>
    `;
	}

	private _applyStyles(): void {
		const styleEl = document.createElement("style");
		styleEl.textContent = `
      /* Screen reader only utility */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }

      /* Calculator specific styles */
      .calculator-mathjs {
        user-select: none;
        -webkit-user-select: none;
      }

      .calculator-display-input {
        cursor: default;
      }

      /* Enhanced focus visibility for WCAG 2.4.7 */
      .calculator-mathjs .btn:focus-visible {
        outline: 3px solid hsl(var(--p));
        outline-offset: 2px;
        z-index: 10;
      }

      /* Touch-friendly button sizing (48x48px minimum) */
      .calculator-mathjs .btn-lg {
        min-height: 48px;
        min-width: 48px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .calculator-mathjs .btn {
          border: 2px solid currentColor;
        }

        .calculator-display {
          border: 2px solid currentColor;
        }
      }

      /* Windows High Contrast Mode */
      @media (forced-colors: active) {
        .calculator-mathjs .btn {
          border: 2px solid ButtonText;
        }

        .calculator-mathjs .btn:focus {
          outline: 3px solid Highlight;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .calculator-mathjs .btn {
          transition: none;
        }
      }

      /* Button press animation */
      @keyframes button-press {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.95); }
      }

      .calculator-mathjs .btn:active {
        animation: button-press 150ms ease-out;
      }
    `;
		this.container.appendChild(styleEl);
	}

	private _cacheElements(): void {
		this.displayEl = this.container.querySelector(
			".calculator-display-input",
		) as HTMLInputElement;
		this.historyEl = this.container.querySelector(
			".calculator-history",
		) as HTMLElement;
		this.statusEl = this.container.querySelector(
			"[aria-live='polite']",
		) as HTMLElement;
		this.errorEl = this.container.querySelector(
			".calculator-error",
		) as HTMLElement;
		this.gridEl = this.container.querySelector("[role='grid']") as HTMLElement;
	}

	private _buildGrid(): void {
		if (!this.gridEl) return;

		const rows = this.gridEl.querySelectorAll("[role='row']");
		this.grid = Array.from(rows).map((row) =>
			Array.from(row.querySelectorAll("[role='gridcell']")),
		) as HTMLElement[][];
	}

	private _attachEventListeners(): void {
		// Button click handlers
		const buttons = this.container.querySelectorAll(".btn");
		buttons.forEach((button) => {
			const handler = (e: Event) => {
				const target = e.currentTarget as HTMLElement;
				const input = target.dataset.input;
				const action = target.dataset.action;
				const func = target.dataset.function;

				if (input) this._handleInput(input);
				else if (action) this._handleAction(action);
				else if (func) this._handleFunction(func);
			};
			button.addEventListener("click", handler);
			this.buttonListeners.push({ element: button, handler });
		});

		// Keyboard shortcuts
		this.boundKeyboardHandler = this._handleKeyboard.bind(this);
		document.addEventListener("keydown", this.boundKeyboardHandler);

		// Grid navigation
		if (this.gridEl) {
			this.boundGridNavHandler = this._handleGridNavigation.bind(this);
			this.gridEl.addEventListener("keydown", this.boundGridNavHandler);
		}
	}

	private _handleInput(input: string): void {
		this.currentExpression += input;
		this._updateDisplay();
		this._announceToScreenReader(`${input}`);
	}

	private _handleAction(action: string): void {
		switch (action) {
			case "clear":
				this.clear();
				this._announceToScreenReader("Cleared");
				break;

			case "clearEntry":
				this.currentExpression = "";
				this._updateDisplay();
				this._announceToScreenReader("Entry cleared");
				break;

			case "backspace":
				this.currentExpression = this.currentExpression.slice(0, -1);
				this._updateDisplay();
				break;

			case "equals":
				this._calculate();
				break;

			case "plusMinus":
				this._toggleSign();
				break;

			case "toggleAngle":
				this._toggleAngleMode();
				break;

			case "memoryClear":
				this.memory = 0;
				this._updateMemoryButtons();
				this._announceToScreenReader("Memory cleared");
				break;

			case "memoryRecall":
				if (this.memory !== 0) {
					this.currentExpression = String(this.memory);
					this._updateDisplay();
					this._announceToScreenReader(`Recalled ${this.memory} from memory`);
				}
				break;

			case "memoryAdd": {
				const addValue = Number.parseFloat(this.currentValue);
				if (!Number.isNaN(addValue)) {
					this.memory += addValue;
					this._updateMemoryButtons();
					this._announceToScreenReader(`Added ${addValue} to memory`);
				}
				break;
			}

			case "memorySubtract": {
				const subValue = Number.parseFloat(this.currentValue);
				if (!Number.isNaN(subValue)) {
					this.memory -= subValue;
					this._updateMemoryButtons();
					this._announceToScreenReader(`Subtracted ${subValue} from memory`);
				}
				break;
			}
		}
	}

	private _handleFunction(func: string): void {
		const value = this.currentExpression || this.currentValue;

		switch (func) {
			case "sin":
			case "cos":
			case "tan":
				this.currentExpression = `${func}(${value} ${this.angleMode})`;
				this._announceToScreenReader(`${func}`);
				break;

			case "sqrt":
				this.currentExpression = `sqrt(${value})`;
				this._announceToScreenReader("Square root");
				break;

			case "log":
				this.currentExpression = `log10(${value})`;
				this._announceToScreenReader("Logarithm base 10");
				break;

			case "ln":
				this.currentExpression = `log(${value})`;
				this._announceToScreenReader("Natural logarithm");
				break;

			case "pow":
				this.currentExpression = `${value}^`;
				this._announceToScreenReader("Power");
				break;
		}

		this._updateDisplay();
	}

	private _handleKeyboard(e: KeyboardEvent): void {
		// Only handle if calculator is focused
		if (!this.container.contains(document.activeElement)) return;

		const key = e.key;

		// Numbers and basic operators
		if (/[0-9\+\-\*\/\.\(\)]/.test(key)) {
			e.preventDefault();
			this._handleInput(key);
		} else if (key === "Enter" || key === "=") {
			e.preventDefault();
			this._calculate();
		} else if (key === "Escape" || key.toLowerCase() === "c") {
			e.preventDefault();
			this.clear();
		} else if (key === "Backspace") {
			e.preventDefault();
			this.currentExpression = this.currentExpression.slice(0, -1);
			this._updateDisplay();
		} else if (key === "%") {
			e.preventDefault();
			this._handleInput("%");
		}

		// Scientific functions
		if (this.type === "scientific") {
			if (key.toLowerCase() === "s") {
				e.preventDefault();
				this._handleFunction("sin");
			} else if (key.toLowerCase() === "o") {
				e.preventDefault();
				this._handleFunction("cos");
			} else if (key.toLowerCase() === "t") {
				e.preventDefault();
				this._handleFunction("tan");
			} else if (key.toLowerCase() === "q") {
				e.preventDefault();
				this._handleFunction("sqrt");
			}
		}
	}

	private _handleGridNavigation(e: KeyboardEvent): void {
		if (!this.grid.length) return;

		let handled = false;

		switch (e.key) {
			case "ArrowUp":
				this.currentRow = Math.max(0, this.currentRow - 1);
				handled = true;
				break;

			case "ArrowDown":
				this.currentRow = Math.min(this.grid.length - 1, this.currentRow + 1);
				handled = true;
				break;

			case "ArrowLeft":
				this.currentCol = Math.max(0, this.currentCol - 1);
				handled = true;
				break;

			case "ArrowRight":
				this.currentCol = Math.min(
					this.grid[this.currentRow].length - 1,
					this.currentCol + 1,
				);
				handled = true;
				break;

			case "Home":
				this.currentCol = 0;
				handled = true;
				break;

			case "End":
				this.currentCol = this.grid[this.currentRow].length - 1;
				handled = true;
				break;

			case "Enter":
			case " ": {
				const button = this.grid[this.currentRow][this.currentCol];
				if (button && !button.hasAttribute("disabled")) {
					button.click();
					handled = true;
				}
				break;
			}
		}

		if (handled) {
			e.preventDefault();
			this._updateGridFocus();
		}
	}

	private _updateGridFocus(): void {
		const button = this.grid[this.currentRow]?.[this.currentCol];
		if (button) {
			button.focus();
			if (this.gridEl) {
				this.gridEl.setAttribute("aria-activedescendant", button.id || "");
			}
		}
	}

	private _toggleSign(): void {
		if (this.currentValue !== "0") {
			const num = Number.parseFloat(this.currentValue);
			this.currentValue = String(-num);
			this._updateDisplay();
			this._announceToScreenReader(
				`${num > 0 ? "Negative" : "Positive"} ${Math.abs(num)}`,
			);
		}
	}

	private _toggleAngleMode(): void {
		this.angleMode = this.angleMode === "deg" ? "rad" : "deg";
		const btn = this.container.querySelector('[data-action="toggleAngle"]');
		if (btn) {
			btn.textContent = this.angleMode.toUpperCase();
			btn.setAttribute(
				"aria-label",
				`Toggle angle mode. Current mode: ${this.angleMode === "deg" ? "degrees" : "radians"}`,
			);
		}
		this._announceToScreenReader(
			`Angle mode: ${this.angleMode === "deg" ? "degrees" : "radians"}`,
		);
	}

	private _calculate(): void {
		if (!this.currentExpression) return;

		try {
			const result = this.math.evaluate(this.currentExpression);
			const resultStr = this._formatResult(result);

			this.history.push({
				expression: this.currentExpression,
				result: resultStr,
				timestamp: Date.now(),
			});

			this.currentValue = resultStr;
			if (this.historyEl) {
				this.historyEl.textContent = `${this.currentExpression} =`;
			}

			this.currentExpression = "";
			this._updateDisplay();
			this._announceToScreenReader(`Result: ${resultStr}`);
			this._hideError();
		} catch (error) {
			this._handleError(error as Error);
		}
	}

	private _handleError(error: Error): void {
		let errorMessage = "An error occurred";

		if (error.message.includes("divide") && error.message.includes("zero")) {
			errorMessage = "Cannot divide by zero";
		} else if (error.message.includes("overflow")) {
			errorMessage = "Result is too large";
		} else if (
			error.message.includes("syntax") ||
			error.message.includes("Unexpected")
		) {
			errorMessage = "Invalid expression";
		}

		this.currentValue = "Error";
		this._updateDisplay();
		this._showError(errorMessage);
		this._announceToScreenReader(errorMessage, true);

		// Auto-hide error after 5 seconds
		setTimeout(() => {
			if (this.currentValue === "Error") {
				this._hideError();
				this.currentValue = "0";
				this._updateDisplay();
			}
		}, 5000);
	}

	private _showError(message: string): void {
		if (this.errorEl) {
			const messageEl = this.errorEl.querySelector(".calculator-error-message");
			if (messageEl) messageEl.textContent = message;
			this.errorEl.classList.remove("hidden");
		}
	}

	private _hideError(): void {
		if (this.errorEl) {
			this.errorEl.classList.add("hidden");
		}
	}

	private _formatResult(result: any): string {
		if (typeof result === "number") {
			// Handle very large/small numbers
			if (Math.abs(result) > 1e10 || Math.abs(result) < 1e-10) {
				return result.toExponential(6);
			}
			// Remove trailing zeros
			return result.toPrecision(10).replace(/\.?0+$/, "");
		}
		return String(result);
	}

	private _updateDisplay(): void {
		if (this.displayEl) {
			const displayValue = this.currentExpression || this.currentValue;
			this.displayEl.value = displayValue;
			this.displayEl.setAttribute(
				"aria-label",
				`Calculator display: ${displayValue}`,
			);
		}
	}

	private _updateMemoryButtons(): void {
		const mrButton = this.container.querySelector(
			'[data-action="memoryRecall"]',
		);
		if (mrButton) {
			if (this.memory === 0) {
				mrButton.setAttribute("disabled", "");
				mrButton.setAttribute("aria-disabled", "true");
			} else {
				mrButton.removeAttribute("disabled");
				mrButton.setAttribute("aria-disabled", "false");
				mrButton.setAttribute(
					"aria-label",
					`Memory recall. Memory contains ${this.memory}`,
				);
			}
		}
	}

	private _announceToScreenReader(
		message: string,
		assertive: boolean = false,
	): void {
		if (this.statusEl) {
			this.statusEl.textContent = message;
		}
	}

	// Public API methods

	getValue(): string {
		return this.currentValue;
	}

	setValue(value: string): void {
		this.currentValue = value;
		this.currentExpression = "";
		this._updateDisplay();
	}

	clear(): void {
		this.currentExpression = "";
		this.currentValue = "0";
		if (this.historyEl) this.historyEl.textContent = "";
		this._updateDisplay();
		this._hideError();
	}

	getHistory(): CalculationHistoryEntry[] {
		return [...this.history];
	}

	clearHistory(): void {
		this.history = [];
		if (this.historyEl) this.historyEl.textContent = "";
	}

	async evaluate(expression: string): Promise<string> {
		try {
			const result = this.math.evaluate(expression);
			return this._formatResult(result);
		} catch (error) {
			throw new Error(`Evaluation error: ${error}`);
		}
	}

	resize(): void {
		// DaisyUI handles responsive design automatically
	}

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

	importState(state: CalculatorState): void {
		if (state.provider !== "mathjs") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}

		this.currentValue = state.value;
		if (state.history) this.history = [...state.history];

		if (state.providerState) {
			this.currentExpression = state.providerState.expression || "";
			this.angleMode = state.providerState.angleMode || "deg";
			this.memory = state.providerState.memory || 0;
		}

		this._updateDisplay();
		this._updateMemoryButtons();
	}

	destroy(): void {
		// Remove event listeners
		if (this.boundKeyboardHandler) {
			document.removeEventListener("keydown", this.boundKeyboardHandler);
			this.boundKeyboardHandler = null;
		}

		if (this.boundGridNavHandler && this.gridEl) {
			this.gridEl.removeEventListener("keydown", this.boundGridNavHandler);
			this.boundGridNavHandler = null;
		}

		for (const { element, handler } of this.buttonListeners) {
			element.removeEventListener("click", handler);
		}
		this.buttonListeners = [];

		// Clear container
		this.container.replaceChildren();

		// Clear references
		this.displayEl = undefined;
		this.historyEl = undefined;
		this.statusEl = undefined;
		this.errorEl = undefined;
		this.gridEl = undefined;
	}
}
