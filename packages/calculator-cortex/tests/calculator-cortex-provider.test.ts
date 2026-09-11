import { afterEach, describe, expect, test } from "bun:test";
import { CortexCalculatorProvider } from "../src/cortex-provider.js";
import { expectCortexRejection } from "./support/cortex-errors.js";

/*
 * The provider's guards, which are everything it does before the browser runtime
 * is reached. Each one turns a host mistake into a typed, recoverable error at the
 * call site instead of a failure inside a mounted Svelte component — and the
 * dynamic `import("./runtime.js")` is the line they all sit in front of, so a guard
 * that moved below it would report the same mistake as a mount crash.
 */

const NAMES = ["window", "document", "HTMLElement", "Worker"] as const;
const originals = new Map(
	NAMES.map((name) => [
		name,
		Object.getOwnPropertyDescriptor(globalThis, name),
	]),
);

function setGlobal(name: (typeof NAMES)[number], value: unknown): void {
	Object.defineProperty(globalThis, name, {
		configurable: true,
		writable: true,
		value,
	});
}

class FakeElement {}

/** Enough of a browser for the guards; the runtime module is never reached. */
function installBrowser(): FakeElement {
	setGlobal("window", {});
	setGlobal("document", {});
	setGlobal("HTMLElement", FakeElement);
	setGlobal("Worker", class {});
	return new FakeElement();
}

afterEach(() => {
	for (const name of NAMES) {
		const descriptor = originals.get(name);
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

describe("what the provider reports about itself", () => {
	test("names itself and the three modes the PRD grants", () => {
		const provider = new CortexCalculatorProvider();
		expect(provider.providerId).toBe("cortex");
		expect(provider.supportedTypes).toEqual([
			"basic",
			"scientific",
			"graphing",
		]);
		for (const type of ["basic", "scientific", "graphing"] as const) {
			expect(provider.supportsType(type)).toBe(true);
		}
		expect(provider.supportsType("matrix" as never)).toBe(false);
	});

	test("reports the precision ceiling the settings actually enforce", () => {
		// 21 is the top of `calculationPrecision`'s accepted range; a capability
		// claiming more would be a promise `resolveCortexSettings` refuses to keep.
		expect(new CortexCalculatorProvider().getCapabilities()).toEqual({
			supportsHistory: true,
			supportsGraphing: true,
			supportsExpressions: true,
			canExport: true,
			maxPrecision: 21,
			inputMethods: ["keyboard", "mouse", "touch"],
		});
	});
});

describe("initialization", () => {
	test("refuses a server, and a browser without module workers", async () => {
		const provider = new CortexCalculatorProvider();
		await expectCortexRejection(provider.initialize(), "worker-unavailable");

		setGlobal("window", {});
		setGlobal("document", {});
		Reflect.deleteProperty(globalThis, "Worker");
		await expectCortexRejection(
			new CortexCalculatorProvider().initialize(),
			"worker-unavailable",
		);
	});

	test("is idempotent and adopts telemetry supplied later", async () => {
		installBrowser();
		const events: string[] = [];
		const provider = new CortexCalculatorProvider();
		await provider.initialize({ onTelemetry: (name) => events.push(name) });
		await provider.initialize();
		expect(events).toEqual([]);
	});

	test("refuses to come back after being destroyed", async () => {
		installBrowser();
		const provider = new CortexCalculatorProvider();
		await provider.initialize();
		provider.destroy();
		await expectCortexRejection(provider.initialize(), "worker-unavailable");
	});

	test("destroy is idempotent", async () => {
		installBrowser();
		const provider = new CortexCalculatorProvider();
		await provider.initialize();
		provider.destroy();
		expect(() => provider.destroy()).not.toThrow();
	});
});

describe("guards ahead of the browser runtime", () => {
	test("refuses an unsupported calculator type", async () => {
		const container = installBrowser();
		const provider = new CortexCalculatorProvider();
		await expectCortexRejection(
			provider.createCalculator(
				"matrix" as never,
				container as unknown as HTMLElement,
			),
			"unsupported-expression",
		);
	});

	test("refuses anything that is not an element as a container", async () => {
		installBrowser();
		const provider = new CortexCalculatorProvider();
		for (const container of [null, undefined, {}, "#calculator"]) {
			await expectCortexRejection(
				provider.createCalculator(
					"basic",
					container as unknown as HTMLElement,
					{},
				),
				"invalid-state",
			);
		}
	});

	test("refuses invalid settings before mounting anything", async () => {
		const container = installBrowser();
		const provider = new CortexCalculatorProvider();
		for (const settings of [
			{ displayPrecision: 99 },
			{ angleMode: "gradian" },
			{ historyLimit: -1 },
			{ graph: { viewport: { xMin: 5, xMax: 5, yMin: -1, yMax: 1 } } },
		]) {
			await expectCortexRejection(
				provider.createCalculator(
					"graphing",
					container as unknown as HTMLElement,
					{ settings } as never,
				),
				"invalid-state",
			);
		}
	});
});
