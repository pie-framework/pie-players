import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { elementsRendered } from "../src/pie/elements-rendered.js";
import type { ConfigEntity } from "../src/types/index.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
	customElements.define("rendered-host", class extends HTMLElement {});
	customElements.define("rendered-part", class extends HTMLElement {});
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const config = (tag: string): ConfigEntity =>
	({
		id: "",
		markup: `<${tag} id="1"></${tag}>`,
		elements: { [tag]: `@pie-element/${tag}@1.0.0` },
		models: [{ id: "1", element: tag }],
	}) as ConfigEntity;

function mount(tag: string): { root: HTMLElement; element: HTMLElement } {
	const root = document.createElement("div");
	root.innerHTML = `<p>Stem</p><${tag} id="1"></${tag}>`;
	document.body.appendChild(root);
	return { root, element: root.querySelector(tag) as HTMLElement };
}

const later = (ms: number, run: () => void) =>
	new Promise<void>((resolve) =>
		setTimeout(() => {
			run();
			resolve();
		}, ms),
	);

/** ms from the call to resolution. */
async function timed(settled: Promise<void>): Promise<number> {
	const start = performance.now();
	await settled;
	return performance.now() - start;
}

describe("elementsRendered", () => {
	test("resolves once an element renders, and not before", async () => {
		const { root, element } = mount("rendered-host");
		let renderedAt = 0;
		const rendering = later(40, () => {
			element.innerHTML = "<fieldset>Choices</fieldset>";
			renderedAt = performance.now();
		});
		await elementsRendered(
			root,
			[config("rendered-host")],
			new AbortController().signal,
			1000,
		);
		expect(renderedAt).toBeGreaterThan(0);
		await rendering;
	});

	test("waits for the custom elements an element paints to render", async () => {
		const { root, element } = mount("rendered-host");
		element.innerHTML = "<rendered-part></rendered-part>";
		const part = element.querySelector("rendered-part") as HTMLElement;
		let partRendered = false;
		const rendering = later(40, () => {
			part.innerHTML = "<fieldset>Part A</fieldset>";
			partRendered = true;
		});
		await elementsRendered(
			root,
			[config("rendered-host")],
			new AbortController().signal,
			1000,
		);
		expect(partRendered).toBe(true);
		await rendering;
	});

	test("takes an element still empty once the subtree is quiet as rendering nothing", async () => {
		const { root } = mount("rendered-host");
		const elapsed = await timed(
			elementsRendered(
				root,
				[config("rendered-host")],
				new AbortController().signal,
				50,
			),
		);
		expect(elapsed).toBeGreaterThanOrEqual(45);
		expect(elapsed).toBeLessThan(500);
	});

	test("does not wait for a tag no bundle has defined", async () => {
		const { root } = mount("undefined-host");
		const elapsed = await timed(
			elementsRendered(
				root,
				[config("undefined-host")],
				new AbortController().signal,
				1000,
			),
		);
		expect(elapsed).toBeLessThan(20);
	});

	test("resolves when aborted", async () => {
		const { root } = mount("rendered-host");
		const abort = new AbortController();
		const settled = elementsRendered(
			root,
			[config("rendered-host")],
			abort.signal,
			1000,
		);
		abort.abort();
		expect(await timed(settled)).toBeLessThan(20);
	});
});
