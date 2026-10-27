import { describe, expect, test } from "bun:test";
import {
	elementNamesLanguage,
	loadElementNames,
	localizedElementName,
} from "../element-names.ts";
import ar from "../element-names/ar.json";
import data from "../periodic-table-data.json";

const hydrogen = { name: "Hydrogen", number: 1 };

describe("elementNamesLanguage", () => {
	test("reads the primary language subtag", () => {
		expect(elementNamesLanguage("ar")).toBe("ar");
		expect(elementNamesLanguage("ar-SA")).toBe("ar");
		expect(elementNamesLanguage("AR_eg")).toBe("ar");
		expect(elementNamesLanguage(undefined)).toBe("");
	});
});

describe("loadElementNames", () => {
	test("loads the Arabic set once", async () => {
		const names = await loadElementNames("ar");
		expect(names).toEqual(ar);
		expect(await loadElementNames("ar")).toBe(names);
	});

	test("has no set for languages the English data covers", async () => {
		expect(await loadElementNames("en")).toBeUndefined();
		expect(await loadElementNames("")).toBeUndefined();
	});
});

describe("localizedElementName", () => {
	test("reads a loaded set and falls back to the English data", () => {
		expect(localizedElementName(hydrogen, ar)).toBe(ar["1"]);
		expect(localizedElementName(hydrogen, undefined)).toBe("Hydrogen");
	});

	test("the Arabic set names every element in the table", () => {
		for (const element of data.elements) {
			const name = localizedElementName(element, ar);
			expect(name).not.toBe(element.name);
			expect(name).toMatch(/^\p{Script=Arabic}[\p{Script=Arabic}\s]*$/u);
		}
	});
});
