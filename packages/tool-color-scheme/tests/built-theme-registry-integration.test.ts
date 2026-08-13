import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { registerPieColorSchemes } = await import("@pie-players/pie-theme");
await import("../dist/tool-color-scheme.js");

const settle = async () => {
	await Promise.resolve();
	await new Promise((resolve) => setTimeout(resolve, 0));
};

beforeAll(() => {
	document.body.replaceChildren();
});

afterAll(async () => {
	document.body.replaceChildren();
	await settle();
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("the built picker observes the host theme package registry", async () => {
	const picker = document.createElement("pie-tool-theme");
	picker.setAttribute("visible", "");
	document.body.append(picker);
	await settle();

	const trigger = picker.shadowRoot?.querySelector<HTMLButtonElement>(
		".pie-tool-color-scheme__dropdown-trigger",
	);
	expect(trigger).not.toBeNull();
	trigger?.click();
	await settle();

	const receipt = registerPieColorSchemes([
		{
			id: "host-registered-after-picker-mount",
			name: "Host Late Scheme",
			variables: { "--pie-primary": "#123456" },
		},
	]);
	await settle();

	const lateOption = picker.shadowRoot?.querySelector<HTMLButtonElement>(
		'[aria-label="Host Late Scheme"]',
	);
	expect(lateOption).not.toBeNull();
	lateOption?.focus();
	expect(picker.shadowRoot?.activeElement).toBe(lateOption);

	receipt.unregister();
	await settle();
	expect(
		picker.shadowRoot?.querySelector('[aria-label="Host Late Scheme"]'),
	).toBeNull();
	expect(picker.shadowRoot?.activeElement).toBe(trigger);
});
