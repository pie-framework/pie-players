import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, expect, test } from "bun:test";

// The panel's custom element is defined once per test process, in the window
// registered first, so this file leaves happy-dom registered for the next one.
if (typeof window === "undefined") GlobalRegistrator.register();

await import("../TtsSettingsPanel.svelte");

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

const SHADOW_BUTTONS_TAG = "test-shadow-buttons";

// Renders its buttons into an open shadow root, as every PIE tool does: it
// stands in for a toolbar opening the panel.
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
	const panel = document.createElement("pie-section-player-tools-tts-settings");
	document.body.append(panel);
	await settle();
	return panel;
};

afterEach(async () => {
	document.body.replaceChildren();
	await settle();
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

test("Escape dispatches a non-bubbling close event on the panel element", async () => {
	const panel = await mountPanel();
	const closes: Event[] = [];
	panel.addEventListener("close", (event) => closes.push(event));
	let bubbledToBody = false;
	document.body.addEventListener("close", () => {
		bubbledToBody = true;
	});

	panel
		.querySelector("[role='dialog'] button")
		?.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Escape",
				bubbles: true,
				composed: true,
				cancelable: true,
			}),
		);

	expect(closes).toHaveLength(1);
	expect(closes[0]).toBeInstanceOf(CustomEvent);
	expect(closes[0].bubbles).toBe(false);
	expect(closes[0].composed).toBe(false);
	expect(bubbledToBody).toBe(false);
});
