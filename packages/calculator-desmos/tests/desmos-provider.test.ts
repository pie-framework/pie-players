import { afterEach, describe, expect, test } from "bun:test";
import type { CalculatorType } from "@pie-players/pie-calculator";
import {
	DesmosCalculatorProvider,
	type DesmosCalculatorProviderConfig,
	type DesmosCalculatorSettings,
} from "../src/index.js";

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

function installScriptLoadingBrowser(): {
	getLoadedSrc: () => string;
} {
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
	return { getLoadedSrc: () => loadedSrc };
}

interface CapturedConstructorCall {
	type: CalculatorType;
	container: HTMLElement;
	config: DesmosCalculatorSettings;
	destroyed: boolean;
}

function installDesmosStub(): CapturedConstructorCall[] {
	const calls: CapturedConstructorCall[] = [];
	const capture =
		(type: CalculatorType) =>
		(container: HTMLElement, config: DesmosCalculatorSettings) => {
			const call: CapturedConstructorCall = {
				type,
				container,
				config,
				destroyed: false,
			};
			calls.push(call);
			return {
				destroy: () => {
					call.destroyed = true;
				},
				setBlank: () => {},
			};
		};

	setGlobal("window", {
		Desmos: {
			FourFunctionCalculator: capture("basic"),
			ScientificCalculator: capture("scientific"),
			GraphingCalculator: capture("graphing"),
		},
	});
	setGlobal("document", {});
	return calls;
}

describe("DesmosCalculatorProvider loading contract", () => {
	test("preserves the legacy unkeyed Desmos load when no config is supplied", async () => {
		const browser = installScriptLoadingBrowser();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		const url = new URL(browser.getLoadedSrc());
		expect(url.pathname).toBe("/api/v1.12/calculator.js");
		expect(url.searchParams.has("apiKey")).toBe(false);
	});

	test("loads only the official v1.12 URL with the supplied key", async () => {
		const browser = installScriptLoadingBrowser();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize({ apiKey: " licensed key/? " });

		const url = new URL(browser.getLoadedSrc());
		expect(url.origin).toBe("https://www.desmos.com");
		expect(url.pathname).toBe("/api/v1.12/calculator.js");
		expect(url.searchParams.get("apiKey")).toBe("licensed key/?");
	});

	test("supports runtime endpoint initialization without treating the browser key as secret", async () => {
		const browser = installScriptLoadingBrowser();
		const previousFetch = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ apiKey: "runtime licensed key" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			})) as typeof fetch;
		try {
			const provider = new DesmosCalculatorProvider();
			await provider.initialize({ proxyEndpoint: "/runtime/desmos-key" });

			expect(new URL(browser.getLoadedSrc()).searchParams.get("apiKey")).toBe(
				"runtime licensed key",
			);
		} finally {
			globalThis.fetch = previousFetch;
		}
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
});

describe("DesmosCalculatorProvider instance configuration", () => {
	test("passes adapter-owned options to every calculator type", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		const container = {} as HTMLElement;
		const config: DesmosCalculatorProviderConfig = {
			theme: "light",
			settings: { degreeMode: true, settingsMenu: true },
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

	test("applies restricted mode after all instance options", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		await provider.createCalculator("graphing", {} as HTMLElement, {
			restrictedMode: true,
			settings: {
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

	test("never passes provider credentials as constructor options", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();

		await provider.createCalculator("graphing", {} as HTMLElement, {
			settings: {
				apiKey: "settings-instance-key",
				proxyEndpoint: "/settings-runtime-key",
			},
		});

		expect(calls[0]?.config).not.toHaveProperty("apiKey");
		expect(calls[0]?.config).not.toHaveProperty("proxyEndpoint");
	});
});

function mountedContainer(): HTMLElement {
	let cleared = 0;
	return {
		replaceChildren: () => {
			cleared += 1;
		},
		get clearedCount() {
			return cleared;
		},
	} as unknown as HTMLElement;
}

describe("DesmosCalculatorProvider teardown", () => {
	test("destroys every calculator it handed out", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		const containers = [mountedContainer(), mountedContainer()];
		await provider.createCalculator("graphing", containers[0] as HTMLElement);
		await provider.createCalculator("scientific", containers[1] as HTMLElement);

		// A host's one call to release the provider. Without instance tracking both
		// calculators stayed mounted with their vendor instances running.
		provider.destroy();
		expect(calls.map((call) => call.destroyed)).toEqual([true, true]);
		for (const container of containers) {
			expect(
				(container as unknown as { clearedCount: number }).clearedCount,
			).toBe(1);
		}
	});

	test("destroys a calculator once, however many times it is asked", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		const container = mountedContainer();
		const calculator = await provider.createCalculator(
			"basic",
			container as HTMLElement,
		);

		calculator.destroy();
		calculator.destroy();
		provider.destroy();
		expect(calls).toHaveLength(1);
		expect(
			(container as unknown as { clearedCount: number }).clearedCount,
		).toBe(1);
	});

	test("does not reach a calculator that already destroyed itself", async () => {
		const calls = installDesmosStub();
		const provider = new DesmosCalculatorProvider();
		await provider.initialize();
		const calculator = await provider.createCalculator(
			"graphing",
			mountedContainer(),
		);
		calculator.destroy();
		expect(() => provider.destroy()).not.toThrow();
		expect(calls[0]?.destroyed).toBe(true);
	});
});
