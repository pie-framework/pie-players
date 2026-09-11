import { describe, expect, test } from "bun:test";
import { createCalculatorConfigKey } from "../calculator-config-key.js";

describe("createCalculatorConfigKey", () => {
	test("treats equivalent recreated configuration as the same mount", () => {
		expect(
			createCalculatorConfigKey({
				settings: { showResetIcon: true, nested: { second: 2, first: 1 } },
				restrictedMode: true,
			}),
		).toBe(
			createCalculatorConfigKey({
				restrictedMode: true,
				settings: { nested: { first: 1, second: 2 }, showResetIcon: true },
			}),
		);
	});

	test("changes when provider settings change", () => {
		expect(
			createCalculatorConfigKey({ settings: { degreeMode: true } }),
		).not.toBe(createCalculatorConfigKey({ settings: { degreeMode: false } }));
	});
});
