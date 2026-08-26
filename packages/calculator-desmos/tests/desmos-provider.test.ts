import { afterEach, describe, expect, test } from "bun:test";
import {
	DesmosCalculatorProvider,
	type DesmosCalculatorConfig,
	type DesmosCalculatorProviderConfig,
} from "../src/index";
import type { CalculatorType } from "@pie-players/pie-calculator";

interface CapturedConstructorCall {
	type: CalculatorType;
	container: HTMLElement;
	config: DesmosCalculatorConfig;
}

const originalWindow = globalThis.window;

const installDesmosStub = (): CapturedConstructorCall[] => {
	const calls: CapturedConstructorCall[] = [];
	const capture = (type: CalculatorType) =>
		(container: HTMLElement, config: DesmosCalculatorConfig) => {
			calls.push({ type, container, config });
			return {};
		};

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		writable: true,
		value: {
			Desmos: {
				FourFunctionCalculator: capture("basic"),
				ScientificCalculator: capture("scientific"),
				GraphingCalculator: capture("graphing"),
			},
		},
	});

	return calls;
};

afterEach(() => {
	if (originalWindow === undefined) {
		Reflect.deleteProperty(globalThis, "window");
		return;
	}

	Object.defineProperty(globalThis, "window", {
		configurable: true,
		writable: true,
		value: originalWindow,
	});
});

describe("DesmosCalculatorProvider configuration", () => {
	test("passes nested Desmos options to every calculator type", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		const container = {} as HTMLElement;
		const config: DesmosCalculatorProviderConfig = {
			theme: "light",
			settings: { source: "test" },
			desmos: {
				degreeMode: true,
				settingsMenu: true,
			},
		};

		for (const type of ["basic", "scientific", "graphing"] as const) {
			await provider.createCalculator(type, container, config);
		}

		expect(calls.map(({ type }) => type)).toEqual([
			"basic",
			"scientific",
			"graphing",
		]);
		for (const call of calls) {
			expect(call.container).toBe(container);
			expect(call.config.degreeMode).toBe(true);
			expect(call.config.settingsMenu).toBe(true);
			expect(call.config).not.toHaveProperty("theme");
			expect(call.config).not.toHaveProperty("settings");
		}
	});

	test("applies restricted mode after instance options", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		await provider.createCalculator("graphing", {} as HTMLElement, {
			restrictedMode: true,
			desmos: {
				expressionsTopbar: true,
				settingsMenu: true,
				zoomButtons: true,
				expressions: true,
				links: true,
			},
		});

		expect(calls[0]?.config).toMatchObject({
			expressionsTopbar: false,
			settingsMenu: false,
			zoomButtons: false,
			expressions: false,
			links: false,
		});
	});

	test("uses the provider API key instead of an instance option", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize({ apiKey: "provider-key" });

		await provider.createCalculator("basic", {} as HTMLElement, {
			desmos: { apiKey: "instance-key" },
		});

		expect(calls[0]?.config.apiKey).toBe("provider-key");
	});
});
