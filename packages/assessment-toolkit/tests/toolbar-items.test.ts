import { describe, expect, test } from "bun:test";
import { isValidToolbarItemShape } from "../src/services/toolbar-items.js";

describe("toolbar-items validation", () => {
	test("accepts valid button item shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "customAction",
				label: "Custom Action",
				onClick: () => {},
			}),
		).toBe(true);
	});

	test("accepts valid link item shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "docsLink",
				label: "Open docs",
				href: "https://example.com",
			}),
		).toBe(true);
	});

	test("rejects malformed host button shape", () => {
		expect(
			isValidToolbarItemShape({
				id: "broken",
				label: "Broken",
				href: "https://example.com",
				onClick: () => {},
			}),
		).toBe(false);
		expect(
			isValidToolbarItemShape({
				id: "",
				label: "Missing id",
				onClick: () => {},
			}),
		).toBe(false);
	});

	test("keeps only valid items in mixed host button inputs", () => {
		const mixedInputs = [
			{
				id: "valid-button",
				label: "Valid Button",
				onClick: () => {},
			},
			null,
			{
				id: "broken-link",
				label: "Broken Link",
				href: 123,
			},
			{
				id: "valid-link",
				label: "Valid Link",
				href: "https://example.com",
			},
		];
		const valid = mixedInputs.filter((entry) => isValidToolbarItemShape(entry));
		expect(valid.map((entry) => entry.id)).toEqual(["valid-button", "valid-link"]);
	});
});
