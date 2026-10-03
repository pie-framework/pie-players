import { afterEach, describe, expect, mock, test } from "bun:test";

import {
	initializeMathRendering,
	type MathRenderingAPI,
	setMathRenderer,
} from "../src/pie/math-rendering";

const makeRenderer = (): MathRenderingAPI => ({
	renderMath: () => {},
});

// Either shape of the module. bun updates an imported mock in place and keeps
// the export names it first had, so every mock names both.
const moduleShape = (
	exports:
		| { _dll_pie_lib__math_rendering: MathRenderingAPI }
		| { evaluateMathRenderingModule: () => MathRenderingAPI },
) => ({
	_dll_pie_lib__math_rendering: undefined,
	evaluateMathRenderingModule: undefined,
	...exports,
});

describe("initializeMathRendering", () => {
	const originalWindow = (globalThis as any).window;

	afterEach(() => {
		mock.restore();
		(globalThis as any).window = originalWindow;
	});

	test("shares one in-flight init across parallel calls", async () => {
		let importCount = 0;
		let setCount = 0;

		mock.module("@pie-lib/math-rendering-module/module/index.js", () => {
			importCount += 1;
			return moduleShape({
				_dll_pie_lib__math_rendering: makeRenderer(),
			});
		});

		const windowStub: Record<string, unknown> = {};
		Object.defineProperty(windowStub, "@pie-lib/math-rendering", {
			configurable: true,
			get() {
				return undefined;
			},
			set(_value: unknown) {
				setCount += 1;
			},
		});
		Object.defineProperty(windowStub, "_dll_pie_lib__math_rendering", {
			configurable: true,
			get() {
				return undefined;
			},
			set() {},
		});
		(globalThis as any).window = windowStub;

		await Promise.all([initializeMathRendering(), initializeMathRendering()]);

		expect(importCount).toBe(1);
		expect(setCount).toBe(1);
	});

	test("evaluates a deferred module and installs its renderer", async () => {
		const renderer = makeRenderer();
		let evaluations = 0;
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({
				evaluateMathRenderingModule: () => {
					evaluations += 1;
					return renderer;
				},
			}),
		);

		const windowStub: Record<string, unknown> = {};
		(globalThis as any).window = windowStub;

		await initializeMathRendering();

		expect(evaluations).toBe(1);
		expect(windowStub["@pie-lib/math-rendering"]).toBe(renderer);
		expect(windowStub._dll_pie_lib__math_rendering).toBe(renderer);
	});

	test("does not replace a custom renderer installed while the default import is in flight", async () => {
		const defaultRenderer = makeRenderer();
		const customRenderer = makeRenderer();
		mock.module("@pie-lib/math-rendering-module/module/index.js", () =>
			moduleShape({ _dll_pie_lib__math_rendering: defaultRenderer }),
		);

		const windowStub: Record<string, unknown> = {};
		(globalThis as any).window = windowStub;

		const defaultInitialization = initializeMathRendering();
		setMathRenderer(customRenderer);
		await defaultInitialization;

		expect(windowStub["@pie-lib/math-rendering"]).toBe(customRenderer);
		expect(windowStub._dll_pie_lib__math_rendering).toBe(customRenderer);
	});
});
