import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorProviderInit,
	CalculatorType,
} from "@pie-players/pie-calculator";
import { CortexCalculatorError } from "./errors.js";
import { resolveCortexSettings } from "./settings.js";
import type { CortexCalculatorProviderConfig } from "./types.js";

export class CortexCalculatorProvider implements CalculatorProvider {
	readonly providerId = "cortex";
	readonly providerName = "PIE Open-Source Calculator";
	readonly supportedTypes: CalculatorType[] = ["basic", "scientific", "graphing"];
	readonly version = "1";

	private initialized = false;
	private destroyed = false;
	private readonly instances = new Set<Calculator>();
	private onTelemetry: CortexCalculatorProviderConfig["onTelemetry"];

	constructor(config: CortexCalculatorProviderConfig = {}) {
		this.onTelemetry = config.onTelemetry;
	}

	async initialize(config: CalculatorProviderInit = {}): Promise<void> {
		if (this.initialized) return;
		if (this.destroyed) {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"This calculator provider has been destroyed.",
				{ recoverable: false },
			);
		}
		if (typeof window === "undefined" || typeof document === "undefined") {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"Cortex calculators can only be initialized in a browser.",
				{ recoverable: false },
			);
		}
		if (typeof Worker === "undefined") {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"This browser does not support module workers.",
				{ recoverable: false },
			);
		}
		this.onTelemetry = config.onTelemetry ?? this.onTelemetry;
		this.initialized = true;
	}

	async createCalculator(
		type: CalculatorType,
		container: HTMLElement,
		config: CalculatorProviderConfig = {},
	): Promise<Calculator> {
		if (!this.initialized) await this.initialize();
		if (!this.supportsType(type)) {
			throw new CortexCalculatorError(
				"unsupported-expression",
				`Cortex does not support calculator type: ${type}.`,
			);
		}
		if (!(container instanceof HTMLElement)) {
			throw new CortexCalculatorError(
				"invalid-state",
				"A valid HTML container is required.",
			);
		}
		const settings = resolveCortexSettings(type, config);
		const { createCortexCalculator } = await import("./runtime.js");
		const calculator = createCortexCalculator(
			this,
			container,
			settings,
			this.onTelemetry,
			(instance) => this.instances.delete(instance),
		);
		this.instances.add(calculator);
		return calculator;
	}

	supportsType(type: CalculatorType): boolean {
		return this.supportedTypes.includes(type);
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		for (const instance of [...this.instances]) instance.destroy();
		this.instances.clear();
		this.initialized = false;
		this.onTelemetry = undefined;
	}

	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: true,
			supportsGraphing: true,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 21,
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}
