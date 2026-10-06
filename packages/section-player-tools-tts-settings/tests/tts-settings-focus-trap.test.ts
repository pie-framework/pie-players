import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

await import("../dist/section-player-tools-tts-settings.js");

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const SHADOW_BUTTONS_TAG = "test-shadow-buttons";

// Renders its buttons into an open shadow root, as every PIE tool does: it
// stands in for a component-mode provider and for a toolbar opening the panel.
class ShadowButtonsElement extends HTMLElement {
	constructor() {
		super();
		const root = this.attachShadow({ mode: "open" });
		for (const label of ["First", "Second"]) {
			const button = document.createElement("button");
			button.type = "button";
			button.textContent = label;
			root.append(button);
		}
	}
}
customElements.define(SHADOW_BUTTONS_TAG, ShadowButtonsElement);

const shadowButtons = (host: Element | null): HTMLButtonElement[] =>
	Array.from(host?.shadowRoot?.querySelectorAll("button") ?? []);

const deepActiveElement = (): Element | null => {
	let active = document.activeElement;
	while (active?.shadowRoot?.activeElement) {
		active = active.shadowRoot.activeElement;
	}
	return active;
};

const mountPanel = async (): Promise<HTMLElement> => {
	const panel = document.createElement(
		"pie-section-player-tools-tts-settings",
	) as HTMLElement & { customProviders?: unknown };
	panel.customProviders = [
		{
			id: "shadow-provider",
			label: "Shadow provider",
			mode: "component",
			tagName: SHADOW_BUTTONS_TAG,
		},
	];
	document.body.append(panel);
	await settle();
	return panel;
};

afterEach(async () => {
	document.body.replaceChildren();
	await settle();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("Shift+Tab between a component provider's shadow controls stays with the browser", async () => {
	const panel = await mountPanel();
	const tab = Array.from(panel.querySelectorAll("button")).find(
		(button) => button.textContent?.trim() === "Shadow provider",
	);
	tab?.click();
	await settle();
	const [, second] = shadowButtons(panel.querySelector(SHADOW_BUTTONS_TAG));
	expect(second).toBeDefined();
	second.focus();

	const shiftTab = new KeyboardEvent("keydown", {
		key: "Tab",
		shiftKey: true,
		bubbles: true,
		composed: true,
		cancelable: true,
	});
	second.dispatchEvent(shiftTab);

	expect(shiftTab.defaultPrevented).toBe(false);
	expect(deepActiveElement()).toBe(second);
});

test("closing the panel returns focus to an opener inside a shadow root", async () => {
	const toolbar = document.createElement(SHADOW_BUTTONS_TAG);
	document.body.append(toolbar);
	const [opener] = shadowButtons(toolbar);
	opener.focus();

	const panel = await mountPanel();
	expect(deepActiveElement()).toBe(
		panel.querySelector("[role='dialog'] button"),
	);

	panel.remove();
	await settle();

	expect(deepActiveElement()).toBe(opener);
});
