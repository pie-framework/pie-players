import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { createFocusTrap } = await import("../src/ui/focus-trap.js");

beforeAll(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	document.body.replaceChildren();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

describe("createFocusTrap in a shadow root", () => {
	test("wraps Tab from the last internal control and restores deep prior focus", async () => {
		const outside = document.createElement("button");
		outside.textContent = "Outside";
		const host = document.createElement("div");
		const shadowRoot = host.attachShadow({ mode: "open" });
		const container = document.createElement("div");
		const first = document.createElement("button");
		const last = document.createElement("button");
		first.textContent = "First";
		last.textContent = "Last";
		container.append(first, last);
		shadowRoot.append(container);
		document.body.append(outside, host);

		outside.focus();
		const cleanup = createFocusTrap(container, { initialFocus: first });
		await Promise.resolve();
		expect(shadowRoot.activeElement).toBe(first);

		last.focus();
		last.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Tab",
				bubbles: true,
				composed: true,
				cancelable: true,
			}),
		);
		expect(shadowRoot.activeElement).toBe(first);

		cleanup();
		expect(document.activeElement).toBe(outside);
	});

	test("claims the Escape it handles, and only that one", () => {
		const container = document.createElement("div");
		const control = document.createElement("button");
		container.append(control);
		document.body.append(container);
		const escapeKey = () =>
			new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				composed: true,
				cancelable: true,
			});

		let escapes = 0;
		const withHandler = createFocusTrap(container, { onEscape: () => escapes++ });
		const handled = escapeKey();
		control.dispatchEvent(handled);
		expect(escapes).toBe(1);
		expect(handled.defaultPrevented).toBe(true);
		withHandler();

		const withoutHandler = createFocusTrap(container);
		const passed = escapeKey();
		control.dispatchEvent(passed);
		expect(passed.defaultPrevented).toBe(false);
		withoutHandler();
	});

	test("leaves an Escape that cancels an IME composition to the IME", () => {
		const container = document.createElement("div");
		const control = document.createElement("button");
		container.append(control);
		document.body.append(container);

		let escapes = 0;
		const release = createFocusTrap(container, { onEscape: () => escapes++ });
		for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
			const composing = new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				composed: true,
				cancelable: true,
				...init,
			});
			control.dispatchEvent(composing);
			expect(composing.defaultPrevented).toBe(false);
		}
		expect(escapes).toBe(0);
		release();
	});
});
