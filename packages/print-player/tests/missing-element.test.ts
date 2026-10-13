import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { defaultMissingElement } from "../src/missing-element.js";
import type { PkgResolution } from "../src/types.js";

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

describe("default missing-element placeholder", () => {
	test("renders the failure message as text", () => {
		const resolution: PkgResolution = {
			tagName: "multiple-choice",
			printTagName: "multiple-choice-print-1",
			pkg: "@pie-element/multiple-choice@13.2.0",
			url: "https://cdn.example.test/print/index.js",
			module: true,
		};
		const message = '<img src="x" onerror="alert(1)">failed';
		customElements.define(
			"multiple-choice-print-1",
			defaultMissingElement(resolution, message),
		);

		const placeholder = document.createElement("multiple-choice-print-1");
		document.body.append(placeholder);

		expect(placeholder.querySelector("img")).toBeNull();
		expect(placeholder.textContent).toContain("Cannot load multiple-choice");
		expect(placeholder.textContent).toContain(message);
		placeholder.remove();
	});
});
