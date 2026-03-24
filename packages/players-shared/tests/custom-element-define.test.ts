import { beforeEach, describe, expect, test } from "bun:test";
import {
	defineCustomElementSafely,
} from "../src/pie/custom-element-define.js";

const HTMLElementBase =
	typeof HTMLElement === "undefined"
		? (class {} as unknown as typeof HTMLElement)
		: HTMLElement;

const createCtor = () =>
	class TestElement extends HTMLElementBase {} as unknown as CustomElementConstructor;

describe("defineCustomElementSafely", () => {
	beforeEach(() => {
		(globalThis as any).customElements = {
			get: () => undefined,
			define: () => undefined,
			whenDefined: async () => undefined,
		};
	});

	test("defines a new element once and reports already-defined on subsequent calls", () => {
		const registry = new Map<string, CustomElementConstructor>();
		(globalThis as any).customElements = {
			get: (tag: string) => registry.get(tag),
			define: (tag: string, ctor: CustomElementConstructor) => {
				if (registry.has(tag)) {
					throw new DOMException(
						`the name "${tag}" has already been used with this registry`,
						"NotSupportedError",
					);
				}
				registry.set(tag, ctor);
			},
			whenDefined: async () => undefined,
		};
		const ctor = createCtor();

		expect(defineCustomElementSafely("pie-test-safe", ctor).status).toBe("defined");
		expect(defineCustomElementSafely("pie-test-safe", ctor).status).toBe(
			"already-defined",
		);
	});

	test("treats duplicate-define race as success when tag becomes registered", () => {
		let isDefined = false;
		const ctor = createCtor();
		(globalThis as any).customElements = {
			get: () => (isDefined ? ctor : undefined),
			define: () => {
				isDefined = true;
				throw new DOMException(
					'the name "pie-test-race" has already been used with this registry',
					"NotSupportedError",
				);
			},
			whenDefined: async () => undefined,
		};

		expect(defineCustomElementSafely("pie-test-race", ctor).status).toBe(
			"already-defined",
		);
	});

	test("rethrows unexpected define failures", () => {
		const ctor = createCtor();
		(globalThis as any).customElements = {
			get: () => undefined,
			define: () => {
				throw new Error("define failed unexpectedly");
			},
			whenDefined: async () => undefined,
		};

		expect(() => defineCustomElementSafely("pie-test-error", ctor)).toThrow(
			"define failed unexpectedly",
		);
	});
});
