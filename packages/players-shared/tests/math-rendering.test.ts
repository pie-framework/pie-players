import { afterEach, describe, expect, mock, test } from "bun:test";

import {
	initializeMathRendering,
	type MathRenderingAPI,
} from "../src/pie/math-rendering";

const makeRenderer = (): MathRenderingAPI => ({
	renderMath: () => {},
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

		mock.module("@pie-lib/math-rendering-module/module", () => {
			importCount += 1;
			return {
				_dll_pie_lib__math_rendering: makeRenderer(),
			};
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
});
