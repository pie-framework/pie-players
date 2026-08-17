import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
	collectFocusable,
	isProgrammaticFocusTarget,
	isTabbable,
} from "../src/ui/first-focusable.js";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
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

/** happy-dom reports no layout, so the visibility half of the filter is stubbed. */
function makeVisible(el: HTMLElement): void {
	Object.defineProperty(el, "getClientRects", {
		configurable: true,
		value: () => [{ width: 10, height: 10 }],
	});
}

function button(label: string): HTMLButtonElement {
	const el = document.createElement("button");
	el.textContent = label;
	makeVisible(el);
	return el;
}

function container(): HTMLElement {
	const root = document.createElement("div");
	makeVisible(root);
	document.body.appendChild(root);
	return root;
}

describe("isTabbable", () => {
	it("rejects tabindex=-1, which isProgrammaticFocusTarget deliberately accepts", () => {
		// The two answer different questions: `focus()` works on a roving-tabindex
		// control or a landmark focused after a view change, but Tab never stops there.
		const el = button("programmatic");
		el.setAttribute("tabindex", "-1");
		container().appendChild(el);
		expect(isProgrammaticFocusTarget(el)).toBe(true);
		expect(isTabbable(el)).toBe(false);
	});
});

/**
 * The defect these pin: focusable collection used `querySelectorAll`, which stops at a
 * shadow boundary. Every tool in this repo renders into `shadow: "open"`, so the focus
 * trap over a panel hosting one collected the panel's own chrome and nothing else — Tab
 * cycled that chrome and the tool's controls were unreachable by keyboard.
 */
describe("collectFocusable", () => {
	it("returns light-DOM controls in document order", () => {
		const root = container();
		root.append(button("one"), button("two"));
		expect(collectFocusable(root).map((el) => el.textContent)).toEqual([
			"one",
			"two",
		]);
	});

	it("finds controls inside an open shadow root", () => {
		const root = container();
		const host = document.createElement("div");
		makeVisible(host);
		host.attachShadow({ mode: "open" }).appendChild(button("inside-shadow"));
		root.append(button("before"), host);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual([
			"before",
			"inside-shadow",
		]);
	});

	it("traverses nested shadow roots", () => {
		const root = container();
		const outer = document.createElement("div");
		makeVisible(outer);
		const inner = document.createElement("div");
		makeVisible(inner);
		inner.attachShadow({ mode: "open" }).appendChild(button("deep"));
		outer.attachShadow({ mode: "open" }).appendChild(inner);
		root.appendChild(outer);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual(["deep"]);
	});

	it("collects a focusable shadow host before its own contents", () => {
		const root = container();
		const host = document.createElement("button");
		host.textContent = "host";
		makeVisible(host);
		host.attachShadow({ mode: "open" }).appendChild(button("child"));
		root.appendChild(host);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual([
			"host",
			"child",
		]);
	});

	it("skips disabled controls and tabindex=-1", () => {
		const root = container();
		const disabled = button("disabled");
		disabled.setAttribute("disabled", "");
		const programmatic = button("programmatic");
		programmatic.setAttribute("tabindex", "-1");
		root.append(button("ok"), disabled, programmatic);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual(["ok"]);
	});

	it("skips an inert subtree, including its shadow content", () => {
		const root = container();
		const inert = document.createElement("div");
		makeVisible(inert);
		inert.setAttribute("inert", "");
		inert.attachShadow({ mode: "open" }).appendChild(button("hidden-by-inert"));
		root.append(button("ok"), inert);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual(["ok"]);
	});

	it("returns nothing for a closed shadow root, which is all that is possible", () => {
		const root = container();
		const host = document.createElement("div");
		makeVisible(host);
		host.attachShadow({ mode: "closed" }).appendChild(button("unreachable"));
		root.append(button("ok"), host);

		expect(collectFocusable(root).map((el) => el.textContent)).toEqual(["ok"]);
	});

	it("returns nothing for an empty container rather than throwing", () => {
		expect(collectFocusable(container())).toEqual([]);
	});
});
