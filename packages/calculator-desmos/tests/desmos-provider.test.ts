import { afterEach, describe, expect, test } from "bun:test";
import { DesmosCalculatorProvider } from "../src/desmos-provider.js";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalDocument = Object.getOwnPropertyDescriptor(
	globalThis,
	"document",
);

function setGlobal(name: "window" | "document", value: unknown): void {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		writable: true,
		value,
	});
}

function restoreGlobal(
	name: "window" | "document",
	descriptor: PropertyDescriptor | undefined,
): void {
	if (descriptor) Object.defineProperty(globalThis, name, descriptor);
	else Reflect.deleteProperty(globalThis, name);
}

afterEach(() => {
	restoreGlobal("window", originalWindow);
	restoreGlobal("document", originalDocument);
});

describe("DesmosCalculatorProvider loading contract", () => {
	test("preserves the legacy unkeyed Desmos load when no config is supplied", async () => {
		let loadedSrc = "";
		const browserWindow: { Desmos?: Record<string, unknown> } = {};
		setGlobal("window", browserWindow);
		setGlobal("document", {
			createElement: () => ({
				src: "",
				async: false,
				onload: null as null | (() => void),
				onerror: null as null | (() => void),
			}),
			head: {
				appendChild: (script: { src: string; onload: null | (() => void) }) => {
					loadedSrc = script.src;
					browserWindow.Desmos = {};
					script.onload?.();
				},
			},
		});

		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		const url = new URL(loadedSrc);
		expect(url.pathname).toBe("/api/v1.12/calculator.js");
		expect(url.searchParams.has("apiKey")).toBe(false);
	});

	test("loads only the official v1.12 URL with the supplied key", async () => {
		let loadedSrc = "";
		const browserWindow: { Desmos?: Record<string, unknown> } = {};
		setGlobal("window", browserWindow);
		setGlobal("document", {
			createElement: () => ({
				src: "",
				async: false,
				onload: null as null | (() => void),
				onerror: null as null | (() => void),
			}),
			head: {
				appendChild: (script: { src: string; onload: null | (() => void) }) => {
					loadedSrc = script.src;
					browserWindow.Desmos = {};
					script.onload?.();
				},
			},
		});

		const provider = new DesmosCalculatorProvider();
		await provider.initialize({ apiKey: " licensed key/? " });

		const url = new URL(loadedSrc);
		expect(url.origin).toBe("https://www.desmos.com");
		expect(url.pathname).toBe("/api/v1.12/calculator.js");
		expect(url.searchParams.get("apiKey")).toBe("licensed key/?");
	});

	test("accepts an authorized API build preloaded by the host", async () => {
		setGlobal("window", { Desmos: {} });
		let createdScript = false;
		setGlobal("document", {
			createElement: () => {
				createdScript = true;
				return {};
			},
		});

		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		expect(createdScript).toBe(false);
	});

	test("does not pass API credentials as calculator constructor options", async () => {
		let calculatorOptions: Record<string, unknown> | undefined;
		const calculatorApi = {
			destroy: () => {},
			setBlank: () => {},
		};
		setGlobal("window", {
			Desmos: {
				GraphingCalculator: (
					_container: HTMLElement,
					options: Record<string, unknown>,
				) => {
					calculatorOptions = options;
					return calculatorApi;
				},
			},
		});
		setGlobal("document", {});

		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		await provider.createCalculator(
			"graphing",
			{
				querySelector: () => null,
				replaceChildren: () => {},
			} as unknown as HTMLElement,
			{ settings: { degreeMode: true } },
		);

		expect(calculatorOptions).toMatchObject({ degreeMode: true });
		expect(calculatorOptions).not.toHaveProperty("apiKey");
	});
});
