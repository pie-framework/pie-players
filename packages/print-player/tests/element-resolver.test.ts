import { describe, expect, test } from "bun:test";
import { defaultResolve } from "../src/element-resolver";

describe("defaultResolve", () => {
	test("resolves print modules to browser ESM artifacts", async () => {
		const resolution = await defaultResolve(
			"multiple-choice",
			"@pie-element/multiple-choice@13.2.0",
		);

		expect(resolution).toMatchObject({
			tagName: "multiple-choice",
			pkg: "@pie-element/multiple-choice@13.2.0",
			url: "https://cdn.jsdelivr.net/npm/@pie-element/multiple-choice@13.2.0/dist/browser/print/index.js",
			module: true,
			loader: "browser-esm",
		});
	});
});
