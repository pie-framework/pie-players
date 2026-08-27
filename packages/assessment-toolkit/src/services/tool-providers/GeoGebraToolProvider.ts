/** GeoGebra calculator adapter for the generic tool-provider registry. */

import type { CalculatorProvider } from "@pie-players/pie-calculator";
import type {
	ToolProviderApi,
	ToolProviderCapabilities,
} from "./ToolProviderApi.js";

export interface GeoGebraToolProviderConfig {
	scriptUrl?: string;
	appletTimeoutMs?: number;
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

type InitializableGeoGebraProvider = CalculatorProvider & {
	initialize(config: GeoGebraToolProviderConfig): Promise<void>;
};

export class GeoGebraToolProvider
	implements ToolProviderApi<GeoGebraToolProviderConfig, CalculatorProvider>
{
	readonly providerId = "geogebra-calculator";
	readonly providerName = "GeoGebra Calculator";
	readonly category = "calculator" as const;
	readonly version = "6";
	readonly requiresAuth = false;

	private calculatorProvider: InitializableGeoGebraProvider | null = null;

	private async emitTelemetry(
		config: GeoGebraToolProviderConfig,
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await config.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[GeoGebraToolProvider] telemetry callback failed:", error);
		}
	}

	async initialize(config: GeoGebraToolProviderConfig = {}): Promise<void> {
		if (this.calculatorProvider) return;

		const moduleLoadStartedAt = Date.now();
		await this.emitTelemetry(config, "pie-tool-library-load-start", {
			toolId: "calculator",
			operation: "geogebra-provider-module-import",
			backend: "geogebra",
		});

		try {
			const module = (await import("@pie-players/pie-calculator-geogebra")) as {
				GeoGebraCalculatorProvider: new () => InitializableGeoGebraProvider;
			};
			await this.emitTelemetry(config, "pie-tool-library-load-success", {
				toolId: "calculator",
				operation: "geogebra-provider-module-import",
				backend: "geogebra",
				duration: Date.now() - moduleLoadStartedAt,
			});

			const provider = new module.GeoGebraCalculatorProvider();
			await provider.initialize(config);
			this.calculatorProvider = provider;
		} catch (error) {
			await this.emitTelemetry(config, "pie-tool-library-load-error", {
				toolId: "calculator",
				operation: "geogebra-provider-module-import",
				backend: "geogebra",
				duration: Date.now() - moduleLoadStartedAt,
				errorType: "ToolLibraryLoadError",
				message: error instanceof Error ? error.message : String(error),
			});
			this.calculatorProvider?.destroy();
			this.calculatorProvider = null;
			throw new Error(
				"Failed to initialize GeoGebra calculator provider. Confirm that the deployment may load GeoGebra and that its script URL is reachable.",
				{ cause: error },
			);
		}
	}

	async createInstance(): Promise<CalculatorProvider> {
		if (!this.calculatorProvider) {
			throw new Error(
				"[GeoGebraToolProvider] Provider not initialized. Call initialize() first.",
			);
		}
		return this.calculatorProvider;
	}

	getCapabilities(): ToolProviderCapabilities {
		return {
			supportsOffline: false,
			requiresAuth: false,
			maxInstances: null,
			features: {
				basic: true,
				scientific: true,
				graphing: true,
				fourFunction: false,
			},
		};
	}

	isReady(): boolean {
		return this.calculatorProvider !== null;
	}

	destroy(): void {
		this.calculatorProvider?.destroy();
		this.calculatorProvider = null;
	}
}
