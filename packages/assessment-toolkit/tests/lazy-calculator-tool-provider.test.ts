import { describe, expect, test } from "bun:test";
import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorType,
} from "@pie-players/pie-calculator";
import {
	type CalculatorToolProviderInitConfig,
	LazyCalculatorToolProvider,
} from "../src/services/tool-providers/LazyCalculatorToolProvider.js";
import type { ToolProviderCapabilities } from "../src/services/tool-providers/ToolProviderApi.js";

interface TestConfig extends CalculatorToolProviderInitConfig {
	label?: string;
}

const capabilities: ToolProviderCapabilities = {
	supportsOffline: true,
	requiresAuth: false,
	features: {},
};

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

		class TestProvider extends LazyCalculatorToolProvider<TestConfig> {
			readonly providerId = "test";
			readonly providerName = "Test";
			readonly version = "1";
			readonly requiresAuth = false;
			protected getDefinition() {
				return {
					backend: "test",
					moduleImportOperation: "test-import",
					loadProvider: async () => {
						imports += 1;
						return FakeProvider;
					},
					initializationErrorMessage: "test failed",
				};
			}
			getCapabilities(): ToolProviderCapabilities {
				return capabilities;
			}
		}

		const provider = new TestProvider();
		await Promise.all([provider.initialize({}), provider.initialize({})]);

		expect(imports).toBe(1);
		expect(initializations).toBe(1);
		expect(provider.isReady()).toBe(true);
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

		class TestProvider extends LazyCalculatorToolProvider<TestConfig> {
			readonly providerId = "test";
			readonly providerName = "Test";
			readonly version = "1";
			readonly requiresAuth = false;
			protected getDefinition() {
				return {
					backend: "test",
					moduleImportOperation: "test-import",
					loadProvider: async () => SlowProvider,
					initializationErrorMessage: "test failed",
				};
			}
			getCapabilities(): ToolProviderCapabilities {
				return capabilities;
			}
		}

		const provider = new TestProvider();
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
