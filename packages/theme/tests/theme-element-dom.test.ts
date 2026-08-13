import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";

import { registerPieColorSchemes } from "../src/color-schemes.js";
import {
	registerPieThemeProvider,
	type ThemeProviderAdapter,
	unregisterPieThemeProvider,
} from "../src/providers.js";
import type { PieThemeElement } from "../src/theme-element.js";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { definePieTheme } = await import("../src/theme-element.js");

const TEST_TAG = "pie-theme-dom-contract-test";
const TEST_PROVIDER_ID = "theme-dom-contract-provider";
const receipts: Array<{ unregister(): void }> = [];

type MutableMediaQueryList = MediaQueryList & { matches: boolean };

function pieThemeElement(
	attributes: Record<string, string> = {},
): PieThemeElement {
	const element = document.createElement(TEST_TAG) as PieThemeElement;
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	return element;
}

function removePieThemeStyles(target: HTMLElement): void {
	const names = Array.from({ length: target.style.length }, (_, index) =>
		target.style.item(index),
	);
	for (const name of names) {
		if (name.startsWith("--pie-")) target.style.removeProperty(name);
	}
	target.removeAttribute("data-theme");
	target.removeAttribute("data-color-scheme");
}

function installDarkPreference(): () => void {
	const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: (query: string) =>
			({
				matches: query === "(prefers-color-scheme: dark)",
				media: query,
				onchange: null,
				addEventListener() {},
				removeEventListener() {},
				addListener() {},
				removeListener() {},
				dispatchEvent: () => true,
			}) satisfies MediaQueryList,
	});
	return () => {
		if (original) Object.defineProperty(window, "matchMedia", original);
		else Reflect.deleteProperty(window, "matchMedia");
	};
}

beforeAll(() => {
	definePieTheme(TEST_TAG);
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

afterEach(() => {
	for (const receipt of receipts.splice(0)) receipt.unregister();
	unregisterPieThemeProvider(TEST_PROVIDER_ID);
	document.body.replaceChildren();
	removePieThemeStyles(document.documentElement);
	document.documentElement.style.removeProperty("--host-contract-token");
});

describe("pie-theme DOM contract", () => {
	test("does not mutate document scope until connected", () => {
		const element = pieThemeElement({
			scope: "document",
			theme: "dark",
			provider: "none",
		});

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("");

		document.body.append(element);
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("#ffff00");
	});

	test("keeps an explicit light theme when the operating-system preference is dark", () => {
		const restoreMatchMedia = installDarkPreference();
		try {
			const element = pieThemeElement({ theme: "light", provider: "none" });
			document.body.append(element);

			expect(element.getAttribute("data-theme")).toBe("light");
			expect(element.style.getPropertyValue("--pie-primary")).toBe("#3f51b5");
			expect(element.style.getPropertyValue("--pie-background")).toBe(
				"rgba(255, 255, 255, 0)",
			);
		} finally {
			restoreMatchMedia();
		}
	});

	test("retains an unavailable scheme request and applies a late registration", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const element = pieThemeElement({ scheme: "late-host-scheme" });
			document.body.append(element);

			expect(element.getAttribute("data-color-scheme")).toBe(
				"late-host-scheme",
			);
			expect(element.style.getPropertyValue("--pie-primary")).toBe("#3f51b5");
			expect(element.style.getPropertyPriority("--pie-primary")).toBe("");

			const receipt = registerPieColorSchemes([
				{
					id: "late-host-scheme",
					name: "Late host scheme",
					variables: { "--pie-primary": "#123456" },
				},
			]);
			receipts.push(receipt);

			expect(element.style.getPropertyValue("--pie-primary")).toBe("#123456");
			expect(element.getAttribute("data-color-scheme")).toBe(
				"late-host-scheme",
			);

			receipt.unregister();
			expect(element.style.getPropertyValue("--pie-primary")).toBe("#3f51b5");
			expect(element.getAttribute("data-color-scheme")).toBe(
				"late-host-scheme",
			);
		} finally {
			warn.mockRestore();
		}
	});

	test("re-resolves connected elements when a named provider is added or removed", () => {
		const element = pieThemeElement({ provider: TEST_PROVIDER_ID });
		document.body.append(element);
		expect(element.style.getPropertyValue("--pie-primary")).toBe("#3f51b5");

		const provider: ThemeProviderAdapter = {
			id: TEST_PROVIDER_ID,
			canRead: (target) => target === element,
			read: () => ({ "--pie-primary": "#654321" }),
		};
		registerPieThemeProvider(provider);
		expect(element.style.getPropertyValue("--pie-primary")).toBe("#654321");

		unregisterPieThemeProvider(TEST_PROVIDER_ID);
		expect(element.style.getPropertyValue("--pie-primary")).toBe("#3f51b5");
	});

	test("cleans the old target when scope changes and cleans the document on disconnect", () => {
		const element = pieThemeElement({
			theme: "dark",
			scheme: "white-on-black",
		});
		document.body.append(element);

		expect(element.getAttribute("data-theme")).toBe("dark");
		expect(element.getAttribute("data-color-scheme")).toBe("white-on-black");
		expect(element.style.getPropertyValue("--pie-primary")).toBe("#ffff00");

		element.setAttribute("scope", "document");
		expect(element.hasAttribute("data-theme")).toBe(false);
		expect(element.hasAttribute("data-color-scheme")).toBe(false);
		expect(element.style.getPropertyValue("--pie-primary")).toBe("");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
			"white-on-black",
		);
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("#ffff00");

		element.remove();
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		expect(document.documentElement.hasAttribute("data-color-scheme")).toBe(
			false,
		);
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("");
	});

	test("restores the surviving document owner and then the host baseline", () => {
		document.documentElement.setAttribute("data-theme", "host-theme");
		document.documentElement.setAttribute("data-color-scheme", "host-scheme");
		document.documentElement.style.setProperty("--pie-primary", "host-primary");
		document.documentElement.style.setProperty(
			"--host-contract-token",
			"host-token",
			"important",
		);

		const first = pieThemeElement({
			scope: "document",
			theme: "light",
			provider: "none",
		});
		const second = pieThemeElement({
			scope: "document",
			theme: "dark",
			provider: "none",
			variables: '{"--host-contract-token":"second-token"}',
		});
		document.body.append(first, second);
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("#ffff00");
		expect(
			document.documentElement.style.getPropertyValue("--host-contract-token"),
		).toBe("second-token");

		first.setAttribute("scheme", "black-on-white");
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
			"black-on-white",
		);

		const unrelatedReceipt = registerPieColorSchemes([
			{
				id: "unrelated-owner-order-scheme",
				variables: { "--pie-primary": "#123456" },
			},
		]);
		receipts.push(unrelatedReceipt);
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
		expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
			"black-on-white",
		);

		first.remove();
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(document.documentElement.hasAttribute("data-color-scheme")).toBe(
			false,
		);
		expect(
			document.documentElement.style.getPropertyValue("--host-contract-token"),
		).toBe("second-token");

		second.remove();
		expect(document.documentElement.getAttribute("data-theme")).toBe(
			"host-theme",
		);
		expect(document.documentElement.getAttribute("data-color-scheme")).toBe(
			"host-scheme",
		);
		expect(
			document.documentElement.style.getPropertyValue("--pie-primary"),
		).toBe("host-primary");
		expect(
			document.documentElement.style.getPropertyValue("--host-contract-token"),
		).toBe("host-token");
		expect(
			document.documentElement.style.getPropertyPriority(
				"--host-contract-token",
			),
		).toBe("important");
	});

	test("reconnects media observation and removes it with its owned styles", () => {
		const original = Object.getOwnPropertyDescriptor(window, "matchMedia");
		const listeners = new Set<(event: MediaQueryListEvent) => void>();
		const media = {
			matches: true,
			media: "(prefers-color-scheme: dark)",
			onchange: null,
			addEventListener: (
				_type: string,
				listener: EventListenerOrEventListenerObject,
			) => {
				listeners.add(listener as (event: MediaQueryListEvent) => void);
			},
			removeEventListener: (
				_type: string,
				listener: EventListenerOrEventListenerObject,
			) => {
				listeners.delete(listener as (event: MediaQueryListEvent) => void);
			},
			addListener() {},
			removeListener() {},
			dispatchEvent: () => true,
		} as MutableMediaQueryList;
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => media,
		});

		try {
			const element = pieThemeElement({ theme: "auto", provider: "none" });
			document.body.append(element);
			expect(element.getAttribute("data-theme")).toBe("dark");
			expect(listeners.size).toBe(1);

			media.matches = false;
			for (const listener of listeners) {
				listener({ matches: false, media: media.media } as MediaQueryListEvent);
			}
			expect(element.getAttribute("data-theme")).toBe("light");

			element.remove();
			expect(listeners.size).toBe(0);
			expect(element.hasAttribute("data-theme")).toBe(false);
			expect(element.style.getPropertyValue("--pie-primary")).toBe("");

			document.body.append(element);
			expect(listeners.size).toBe(1);
			expect(element.getAttribute("data-theme")).toBe("light");
		} finally {
			if (original) Object.defineProperty(window, "matchMedia", original);
			else Reflect.deleteProperty(window, "matchMedia");
		}
	});
});
