import type {
	CalculatorProvider,
	CalculatorProviderInit,
} from "@pie-players/pie-calculator";
import type { ToolProviderApi } from "@pie-players/pie-assessment-toolkit/tools/registration";

/**
 * One calculator backend, selected by the toolkit's `provider.id`. `load` runs
 * on first use, but a bundler that inlines dynamic imports inlines what it
 * names whether or not the host selects the backend. The packaged set therefore
 * holds only the thin Desmos and GeoGebra adapters, and a host adds any other
 * backend through `createCalculatorToolRegistration`.
 */
export interface CalculatorProviderDefinition {
	/** Names the provider in toolkit logs, telemetry and error messages. */
	readonly providerName: string;
	readonly version: string;
	/**
	 * Whether the registry merges the result of `provider.runtime.authFetcher`
	 * into the configuration `initialize()` receives.
	 */
	readonly requiresAuth: boolean;
	/** The `backend` of library-load telemetry. */
	readonly backend: string;
	/** Loads the adapter's provider class, usually through a dynamic import. */
	readonly load: () => Promise<new () => CalculatorProvider>;
	/** Thrown, with the failure as its cause, when loading or initializing fails. */
	readonly initializationErrorMessage: string;
}

/**
 * Lazy-module and lifecycle implementation shared by every calculator backend:
 * concurrent initialization is deduplicated, and `destroy()` cancels one in
 * flight.
 */
export class LazyCalculatorToolProvider
	implements ToolProviderApi<CalculatorProvider>
{
	readonly providerName: string;
	readonly category = "calculator" as const;
	readonly version: string;
	readonly requiresAuth: boolean;

	private readonly definition: CalculatorProviderDefinition;
	private calculatorProvider: CalculatorProvider | null = null;
	private initializationPromise: Promise<void> | null = null;
	private lifecycleGeneration = 0;

	constructor(definition: CalculatorProviderDefinition) {
		this.definition = definition;
		this.providerName = definition.providerName;
		this.version = definition.version;
		this.requiresAuth = definition.requiresAuth;
	}

	private async emitTelemetry(
		config: CalculatorProviderInit,
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await config.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn(`[${this.providerName}] telemetry callback failed:`, error);
		}
	}

	async initialize(config: CalculatorProviderInit = {}): Promise<void> {
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
		config: CalculatorProviderInit,
		generation: number,
	): Promise<void> {
		const { backend, initializationErrorMessage } = this.definition;
		const operation = `${backend}-provider-module-import`;
		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry(config, "pie-tool-library-load-start", {
			toolId: "calculator",
			operation,
			backend,
		});

		let ProviderConstructor: new () => CalculatorProvider;
		try {
			ProviderConstructor = await this.definition.load();
			await this.emitTelemetry(config, "pie-tool-library-load-success", {
				toolId: "calculator",
				operation,
				backend,
				duration: Date.now() - moduleLoadStartedAt,
			});
		} catch (error) {
			await this.emitTelemetry(config, "pie-tool-library-load-error", {
				toolId: "calculator",
				operation,
				backend,
				duration: Date.now() - moduleLoadStartedAt,
				errorType: "ToolLibraryLoadError",
				message: error instanceof Error ? error.message : String(error),
			});
			throw new Error(initializationErrorMessage, { cause: error });
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
			throw new Error(initializationErrorMessage, { cause: error });
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
