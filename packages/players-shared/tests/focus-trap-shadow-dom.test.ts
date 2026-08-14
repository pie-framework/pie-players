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
});
