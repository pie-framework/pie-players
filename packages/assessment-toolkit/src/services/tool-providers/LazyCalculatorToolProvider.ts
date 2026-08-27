import type {
	CalculatorProvider,
	CalculatorProviderInit,
} from "@pie-players/pie-calculator";
import type {
	ToolProviderApi,
	ToolProviderCapabilities,
} from "./ToolProviderApi.js";

export type CalculatorToolProviderInitConfig = Pick<
	CalculatorProviderInit,
	"onTelemetry"
>;

type InitializableCalculatorProvider<TConfig> = CalculatorProvider & {
	initialize(config: TConfig): Promise<void>;
};

interface LazyCalculatorProviderDefinition<TConfig> {
	backend: string;
	moduleImportOperation: string;
	loadProvider: () => Promise<
		new () => InitializableCalculatorProvider<TConfig>
	>;
	initializationErrorMessage: string;
}

/**
 * Shared lazy-module and lifecycle implementation for calculator tool adapters.
 * Concrete adapters own only their metadata, capabilities and provider import.
 */
export abstract class LazyCalculatorToolProvider<
	TConfig extends CalculatorToolProviderInitConfig,
> implements ToolProviderApi<TConfig, CalculatorProvider>
{
	abstract readonly providerId: string;
	abstract readonly providerName: string;
	readonly category = "calculator" as const;
	abstract readonly version: string;
	abstract readonly requiresAuth: boolean;

	protected abstract getDefinition(): LazyCalculatorProviderDefinition<TConfig>;
	abstract getCapabilities(): ToolProviderCapabilities;

	private calculatorProvider: InitializableCalculatorProvider<TConfig> | null =
		null;
	private initializationPromise: Promise<void> | null = null;
	private lifecycleGeneration = 0;

	private async emitTelemetry(
		config: TConfig,
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await config.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn(`[${this.providerName}] telemetry callback failed:`, error);
		}
	}

	async initialize(config: TConfig = {} as TConfig): Promise<void> {
		if (this.calculatorProvider) return;
		if (this.initializationPromise) return this.initializationPromise;

		const generation = ++this.lifecycleGeneration;
		const initializationPromise = this.initializeProvider(config, generation);
		this.initializationPromise = initializationPromise;
		try {
			await initializationPromise;
		} finally {
			if (this.initializationPromise === initializationPromise) {
				this.initializationPromise = null;
			}
		}
	}

	private async initializeProvider(
		config: TConfig,
		generation: number,
	): Promise<void> {
		const definition = this.getDefinition();
		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry(config, "pie-tool-library-load-start", {
			toolId: "calculator",
			operation: definition.moduleImportOperation,
			backend: definition.backend,
		});

		let ProviderConstructor: new () => InitializableCalculatorProvider<TConfig>;
		try {
			ProviderConstructor = await definition.loadProvider();
			await this.emitTelemetry(config, "pie-tool-library-load-success", {
				toolId: "calculator",
				operation: definition.moduleImportOperation,
				backend: definition.backend,
				duration: Date.now() - moduleLoadStartedAt,
			});
		} catch (error) {
			await this.emitTelemetry(config, "pie-tool-library-load-error", {
				toolId: "calculator",
				operation: definition.moduleImportOperation,
				backend: definition.backend,
				duration: Date.now() - moduleLoadStartedAt,
				errorType: "ToolLibraryLoadError",
				message: error instanceof Error ? error.message : String(error),
			});
			throw new Error(definition.initializationErrorMessage, { cause: error });
		}
		if (generation !== this.lifecycleGeneration) {
			throw new Error(`${this.providerName} initialization was cancelled`);
		}

		const candidate = new ProviderConstructor();
		try {
			await candidate.initialize(config);
			if (generation !== this.lifecycleGeneration) {
				throw new Error(`${this.providerName} initialization was cancelled`);
			}
			this.calculatorProvider = candidate;
		} catch (error) {
			candidate.destroy();
			throw new Error(definition.initializationErrorMessage, { cause: error });
		}
	}

	async createInstance(): Promise<CalculatorProvider> {
		if (!this.calculatorProvider) {
			throw new Error(
				`[${this.providerName}] Provider not initialized. Call initialize() first.`,
			);
		}
		return this.calculatorProvider;
	}

	isReady(): boolean {
		return this.calculatorProvider !== null;
	}

	destroy(): void {
		this.lifecycleGeneration += 1;
		this.initializationPromise = null;
		this.calculatorProvider?.destroy();
		this.calculatorProvider = null;
	}
}
