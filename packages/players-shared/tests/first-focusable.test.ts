import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { isProgrammaticFocusTarget } from "../src/ui/first-focusable.js";

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("isProgrammaticFocusTarget", () => {
	it("returns true for visible focusable controls", () => {
		const root = document.createElement("div");
		root.innerHTML = `<p>x</p><button type="button" id="b">Go</button><input id="i" />`;
		document.body.appendChild(root);
		const button = document.getElementById("b") as HTMLElement;
		Object.defineProperty(button, "offsetParent", {
			value: document.body,
			configurable: true,
		});
		expect(isProgrammaticFocusTarget(button)).toBe(true);
	});

	it("returns false for non-focusable and disabled elements", () => {
		const host = document.createElement("div");
		host.innerHTML = `<span id="span">nope</span><button type="button" id="disabled" disabled>Go</button>`;
		document.body.appendChild(host);
		const span = document.getElementById("span") as HTMLElement;
		const disabled = document.getElementById("disabled") as HTMLElement;
		expect(isProgrammaticFocusTarget(span)).toBe(false);
		expect(isProgrammaticFocusTarget(disabled)).toBe(false);
	});
});
