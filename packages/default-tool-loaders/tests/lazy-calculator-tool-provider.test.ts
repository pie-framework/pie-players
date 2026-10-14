import { describe, expect, test } from "bun:test";
import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorType,
} from "@pie-players/pie-calculator";
import {
	type CalculatorProviderDefinition,
	LazyCalculatorToolProvider,
} from "../src/calculator-providers/LazyCalculatorToolProvider.js";

const testDefinition = (
	load: CalculatorProviderDefinition["load"],
): CalculatorProviderDefinition => ({
	providerName: "Test",
	version: "1",
	requiresAuth: false,
	backend: "test",
	load,
	initializationErrorMessage: "test failed",
});

const calculatorCapabilities: CalculatorProviderCapabilities = {
	supportsHistory: false,
	supportsGraphing: true,
	supportsExpressions: true,
	canExport: false,
	inputMethods: ["keyboard"],
};

describe("LazyCalculatorToolProvider", () => {
	test("deduplicates concurrent initialization", async () => {
		let imports = 0;
		let initializations = 0;

		class FakeProvider implements CalculatorProvider {
			readonly providerId = "fake";
			readonly providerName = "Fake";
			readonly supportedTypes: CalculatorType[] = ["scientific"];
			readonly version = "1";

			async initialize(): Promise<void> {
				initializations += 1;
			}
			async createCalculator(
				_type: CalculatorType,
				_container: HTMLElement,
				_config?: CalculatorProviderConfig,
			): Promise<Calculator> {
				throw new Error("not used");
			}
			supportsType(): boolean {
				return true;
			}
			destroy(): void {}
			getCapabilities(): CalculatorProviderCapabilities {
				return calculatorCapabilities;
			}
		}

		const provider = new LazyCalculatorToolProvider(
			testDefinition(async () => {
				imports += 1;
				return FakeProvider;
			}),
		);
		const telemetry: Array<[string, Record<string, unknown> | undefined]> = [];
		const onTelemetry = (
			eventName: string,
			payload?: Record<string, unknown>,
		) => {
			telemetry.push([eventName, payload]);
		};
		await Promise.all([
			provider.initialize({ onTelemetry }),
			provider.initialize({ onTelemetry }),
		]);

		expect(imports).toBe(1);
		expect(initializations).toBe(1);
		expect(provider.isReady()).toBe(true);
		expect(provider.providerName).toBe("Test");
		expect(telemetry.map(([eventName]) => eventName)).toEqual([
			"pie-tool-library-load-start",
			"pie-tool-library-load-success",
		]);
		expect(telemetry[0]?.[1]).toEqual({
			toolId: "calculator",
			operation: "test-provider-module-import",
			backend: "test",
		});
	});

	test("does not resurrect a provider destroyed during initialization", async () => {
		let finishInitialization: (() => void) | undefined;
		let destroys = 0;

		class SlowProvider implements CalculatorProvider {
			readonly providerId = "slow";
			readonly providerName = "Slow";
			readonly supportedTypes: CalculatorType[] = ["scientific"];
			readonly version = "1";

			async initialize(): Promise<void> {
				await new Promise<void>((resolve) => {
					finishInitialization = resolve;
				});
			}
			async createCalculator(): Promise<Calculator> {
				throw new Error("not used");
			}
			supportsType(): boolean {
				return true;
			}
			destroy(): void {
				destroys += 1;
			}
			getCapabilities(): CalculatorProviderCapabilities {
				return calculatorCapabilities;
			}
		}

		const provider = new LazyCalculatorToolProvider(
			testDefinition(async () => SlowProvider),
		);
		const initialization = provider.initialize({});
		for (let turn = 0; turn < 10 && !finishInitialization; turn += 1) {
			await Promise.resolve();
		}
		expect(finishInitialization).toBeDefined();
		provider.destroy();
		finishInitialization?.();

		await expect(initialization).rejects.toThrow("test failed");
		expect(destroys).toBe(1);
		expect(provider.isReady()).toBe(false);
	});
});
