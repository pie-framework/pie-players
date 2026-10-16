import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { createFocusReturn } = await import("../src/ui/focus-trap.js");

beforeEach(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	document.body.replaceChildren();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

/** A toolbar button inside one shadow root, and a tool inside another. */
function mount() {
	const toolbar = document.createElement("div");
	const button = document.createElement("button");
	toolbar.attachShadow({ mode: "open" }).append(button);
	const host = document.createElement("div");
	const tool = document.createElement("div");
	tool.tabIndex = 0;
	host.attachShadow({ mode: "open" }).append(tool);
	document.body.append(toolbar, host);
	return { toolbar, button, host, tool };
}

describe("createFocusReturn", () => {
	test("returns focus to the control inside another shadow root", () => {
		const { toolbar, button, tool } = mount();
		const focusReturn = createFocusReturn();
		button.focus();
		focusReturn.capture(tool);
		tool.focus();

		focusReturn.restore();
		expect(toolbar.shadowRoot?.activeElement).toBe(button);
	});

	test("keeps the opener when focus is already inside the tool", () => {
		const { toolbar, button, tool } = mount();
		const focusReturn = createFocusReturn();
		button.focus();
		focusReturn.capture(tool);
		tool.focus();
		focusReturn.capture(tool);

		focusReturn.restore();
		expect(toolbar.shadowRoot?.activeElement).toBe(button);
	});

	test("does nothing once the opener has left the document", () => {
		const { toolbar, button, host, tool } = mount();
		const focusReturn = createFocusReturn();
		button.focus();
		focusReturn.capture(tool);
		tool.focus();
		toolbar.remove();

		focusReturn.restore();
		expect(host.shadowRoot?.activeElement).toBe(tool);
	});
});
