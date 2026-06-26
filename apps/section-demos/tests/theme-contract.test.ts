/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";

import { applyDaisyTheme } from "../src/lib/demo-runtime/demo-page-helpers";

class FakeElement {
	private attributes = new Map<string, string>();

	setAttribute(name: string, value: string): void {
		this.attributes.set(name, value);
	}

	getAttribute(name: string): string | null {
		return this.attributes.get(name) ?? null;
	}
}

const installWindow = () => {
	const documentElement = new FakeElement();
	let pieThemeHost: FakeElement | null = null;
	const storage = new Map<string, string>();
	const document = {
		documentElement,
		body: {
			appendChild(element: FakeElement): void {
				pieThemeHost = element;
			},
		},
		createElement: (_tagName: string) => new FakeElement(),
		querySelector: (selector: string) =>
			selector === "pie-theme" || selector === 'pie-theme[scope="document"]'
				? pieThemeHost
				: null,
	};
	const window = {
		document,
		localStorage: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
		},
	};
	(globalThis as { window?: unknown }).window = window;
	(globalThis as { document?: unknown }).document = document;
	return window;
};

afterEach(() => {
	delete (globalThis as { window?: unknown }).window;
	delete (globalThis as { document?: unknown }).document;
});

describe("section demos theme contract", () => {
	test("root layout initializes the shared DaisyUI theme", async () => {
		const source = await Bun.file(
			new URL("../src/routes/+layout.svelte", import.meta.url),
		).text();

		expect(source).toContain("applyDaisyTheme");
		expect(source).toContain("DAISY_THEME_STORAGE_KEY");
		expect(source).toContain("DEFAULT_DAISY_THEME");
	});

	test("applies DaisyUI theme to documentElement without a pie-theme host", () => {
		const window = installWindow();
		let appliedTheme = "";

		applyDaisyTheme("light", (nextTheme) => {
			appliedTheme = nextTheme;
		});

		expect(window.document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(window.localStorage.getItem("pie:section-demos:daisy-theme")).toBe(
			"light",
		);
		expect(appliedTheme).toBe("light");
	});

	test("keeps documentElement and pie-theme host in sync", () => {
		const window = installWindow();
		const pieThemeHost = window.document.createElement("pie-theme");
		window.document.body.appendChild(pieThemeHost);

		applyDaisyTheme("dark", () => {});

		expect(window.document.documentElement.getAttribute("data-theme")).toBe(
			"dark",
		);
		expect(pieThemeHost.getAttribute("theme")).toBe("dark");
	});
});
