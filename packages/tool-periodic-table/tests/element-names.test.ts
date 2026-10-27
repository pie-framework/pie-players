import { describe, expect, test } from "bun:test";
import { localizedElementName } from "../element-names.ts";
import ar from "../element-names/ar.json";
import data from "../periodic-table-data.json";

const hydrogen = { name: "Hydrogen", number: 1 };

describe("localizedElementName", () => {
	test("Arabic interface locales read the Arabic set", () => {
		expect(localizedElementName(hydrogen, "ar")).toBe(ar["1"]);
		expect(localizedElementName(hydrogen, "ar-SA")).toBe(ar["1"]);
		expect(localizedElementName(hydrogen, "AR_eg")).toBe(ar["1"]);
	});

	test("other locales fall back to the English data", () => {
		expect(localizedElementName(hydrogen, "en-US")).toBe("Hydrogen");
		expect(localizedElementName(hydrogen, "es")).toBe("Hydrogen");
		expect(localizedElementName(hydrogen, undefined)).toBe("Hydrogen");
	});

	test("the Arabic set names every element in the table", () => {
		for (const element of data.elements) {
			const name = localizedElementName(element, "ar");
			expect(name).not.toBe(element.name);
			expect(name).toMatch(/^\p{Script=Arabic}[\p{Script=Arabic}\s]*$/u);
		}
	});
});
