import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
	focusFirstFocusableInElement,
	queryFirstFocusableDeep,
} from "../src/ui/first-focusable.js";

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

describe("queryFirstFocusableDeep", () => {
	it("returns the first matching control in light DOM", () => {
		const root = document.createElement("div");
		root.innerHTML = `<p>x</p><button type="button" id="b">Go</button><input id="i" />`;
		document.body.appendChild(root);
		expect(queryFirstFocusableDeep(root)?.id).toBe("b");
	});

	it("enters open shadow roots before later light-DOM siblings", () => {
		const host = document.createElement("div");
		const inner = document.createElement("x-host");
		const sr = inner.attachShadow({ mode: "open" });
		sr.innerHTML = `<input id="in-shadow" />`;
		host.appendChild(inner);
		const after = document.createElement("button");
		after.id = "after";
		host.appendChild(after);
		document.body.appendChild(host);
		expect(queryFirstFocusableDeep(host)?.id).toBe("in-shadow");
	});
});

describe("focusFirstFocusableInElement", () => {
	it("returns false when nothing is focusable", () => {
		const root = document.createElement("div");
		root.innerHTML = `<span>nope</span>`;
		document.body.appendChild(root);
		expect(focusFirstFocusableInElement(root)).toBe(false);
	});

	it("focuses the first deep target", () => {
		const root = document.createElement("div");
		root.innerHTML = `<button type="button" id="b">x</button>`;
		document.body.appendChild(root);
		expect(focusFirstFocusableInElement(root)).toBe(true);
		expect(document.activeElement?.id).toBe("b");
	});
});
