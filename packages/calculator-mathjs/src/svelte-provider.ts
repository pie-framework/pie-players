/**
 * Math.js Calculator Provider - Svelte Implementation
 * Professional WCAG 2.2 Level AA accessible calculator with DaisyUI theming
 *
 * This version uses Svelte 5 components for clean, maintainable code
 */

import { mount, unmount } from 'svelte';
import Calculator from './components/Calculator.svelte';

import type {
	Calculator as ICalculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
	CalculationHistoryEntry,
} from "@pie-players/pie-calculator";

declare global {
	interface Window {
		math?: any;
	}
}

/**
 * Math.js Calculator Provider Implementation (Svelte)
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
	): Promise<ICalculator> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.supportsType(type)) {
			throw new Error(
				`Math.js provider does not support calculator type: ${type}`,
			);
		}

		return new MathJsCalculator(type, container, config);
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
 * Math.js Calculator Instance (Svelte Wrapper)
 * Wraps the Svelte component and exposes the standard Calculator interface
 */
class MathJsCalculator implements ICalculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private container: HTMLElement;
	private component: any;
	private componentInstance: any;

	constructor(
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	) {
		this.provider = new MathJsCalculatorProvider();
		this.type = type;
		this.container = container;

		if (!window.math) {
			throw new Error("Math.js not available");
		}

		// Mount Svelte component
		this.componentInstance = mount(Calculator, {
			target: this.container,
			props: {
				type,
				theme: config?.theme || 'light',
				math: window.math,
				onStateChange: (state: any) => {
					// Handle state changes if needed
				}
			}
		});

		this.component = this.componentInstance;
	}

	// Public API methods (delegate to Svelte component)

	getValue(): string {
		return this.component.getValue();
	}

	setValue(value: string): void {
		this.component.setValue(value);
	}

	clear(): void {
		// Clear is handled by the component internally
		// We can trigger it by calling setValue
		this.component.setValue('0');
		this.component.clearHistory();
	}

	getHistory(): CalculationHistoryEntry[] {
		return this.component.getHistory();
	}

	clearHistory(): void {
		this.component.clearHistory();
	}

	async evaluate(expression: string): Promise<string> {
		try {
			const result = window.math.evaluate(expression);
			return this._formatResult(result);
		} catch (error) {
			throw new Error(`Evaluation error: ${error}`);
		}
	}

	private _formatResult(result: any): string {
		if (typeof result === "number") {
			if (Math.abs(result) > 1e10 || Math.abs(result) < 1e-10) {
				return result.toExponential(6);
			}
			return result.toPrecision(10).replace(/\.?0+$/, "");
		}
		return String(result);
	}

	resize(): void {
		// DaisyUI handles responsive design automatically
	}

	exportState(): CalculatorState {
		return this.component.exportState();
	}

	importState(state: CalculatorState): void {
		this.component.importState(state);
	}

	destroy(): void {
		if (this.componentInstance) {
			unmount(this.componentInstance);
		}
		this.container.replaceChildren();
	}
}
