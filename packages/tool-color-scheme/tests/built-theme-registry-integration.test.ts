import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { registerPieColorSchemes, listPieColorSchemes } = await import("@pie-players/pie-theme");
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
	const defaultScheme = listPieColorSchemes().schemes.find((scheme) => scheme.id === "default")!;
	expect(trigger?.getAttribute("aria-label")).toContain(defaultScheme.name);
	expect(trigger?.getAttribute("aria-label")).toContain(defaultScheme.description);
	expect(trigger?.querySelector('.pie-tool-color-scheme__preview')?.getAttribute('aria-hidden')).toBe('true');
	expect(trigger?.querySelector('.pie-tool-color-scheme__preview')?.textContent?.trim()).toBe('');
	trigger?.click();
	await settle();
	for (const scheme of listPieColorSchemes().schemes) {
		const option = picker.shadowRoot?.querySelector(`[data-scheme-id="${scheme.id}"]`);
		expect(option?.getAttribute('aria-label')).toContain(scheme.name);
		if (scheme.description) expect(option?.getAttribute('aria-label')).toContain(scheme.description);
		expect(option?.querySelector('.pie-tool-color-scheme__preview')?.getAttribute('aria-hidden')).toBe('true');
		expect(option?.querySelector('.pie-tool-color-scheme__preview')?.textContent?.trim()).toBe('');
	}

	const receipt = registerPieColorSchemes([
		{
			id: "host-registered-after-picker-mount",
			name: "Host Late Scheme",
			description: "Colors registered by the host",
			variables: { "--pie-primary": "#123456" },
		},
	]);
	await settle();

	const lateOption = picker.shadowRoot?.querySelector<HTMLButtonElement>(
		'[data-scheme-id="host-registered-after-picker-mount"]',
	);
	expect(lateOption).not.toBeNull();
	expect(lateOption?.getAttribute('aria-label')).toBe('Host Late Scheme Colors registered by the host');
	lateOption?.focus();
	expect(picker.shadowRoot?.activeElement).toBe(lateOption);

	receipt.unregister();
	await settle();
	expect(
		picker.shadowRoot?.querySelector('[data-scheme-id="host-registered-after-picker-mount"]'),
	).toBeNull();
	expect(picker.shadowRoot?.activeElement).toBe(trigger);
});
