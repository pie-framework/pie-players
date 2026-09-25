import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, describe, expect, test } from "bun:test";
import { compile } from "svelte/compiler";
import { guardSvelteCustomElementDefines } from "../svelte-custom-element-guard.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const transform = (code: string, id = "/src/Sample.svelte") =>
	guardSvelteCustomElementDefines().transform(code, id);

// The shape of the registration Svelte compiles for a tagged component.
const registration = (tag: string) =>
	`customElements.define("${tag}", class extends HTMLElement {});`;

const runModule = (code: string) => new Function(code)();

describe("guardSvelteCustomElementDefines", () => {
	test("rewrites the define Svelte compiles for a tagged component", () => {
		const { js } = compile(
			`<svelte:options customElement="pie-guard-compiled" /><p>sample</p>`,
			{ customElement: true, filename: "Sample.svelte" },
		);
		expect(js.code).toMatch(
			/customElements\.define\(\s*["']pie-guard-compiled/,
		);

		const guarded = transform(js.code)?.code ?? "";
		expect(guarded).not.toMatch(
			/customElements\.define\(\s*["']pie-guard-compiled/,
		);
		expect(guarded).toMatch(
			/__pieDefineCustomElement\(\s*["']pie-guard-compiled["']/,
		);
	});

	test("a second copy of the module keeps the first registration", () => {
		const guarded = transform(registration("pie-guard-twice"))?.code ?? "";
		runModule(guarded);
		const first = customElements.get("pie-guard-twice");

		expect(() => runModule(guarded)).not.toThrow();
		expect(customElements.get("pie-guard-twice")).toBe(first);
	});

	test("the unguarded module throws on its second copy", () => {
		const unguarded = registration("pie-guard-control");
		runModule(unguarded);
		expect(() => runModule(unguarded)).toThrow();
	});

	test("leaves modules without a bare define untouched", () => {
		expect(
			transform(registration("pie-guard-ts"), "/src/define.ts"),
		).toBeNull();
		expect(transform("export const answer = 42;")).toBeNull();
		expect(
			transform(`window.customElements.define("pie-guard-window", C);`),
		).toBeNull();
	});

	test("does not guard a module twice", () => {
		const guarded = transform(registration("pie-guard-once"))?.code ?? "";
		expect(transform(guarded)).toBeNull();
	});
});
