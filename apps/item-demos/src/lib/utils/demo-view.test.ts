import { describe, expect, test } from "bun:test";
import { demoViewFromPath } from "./demo-view";

describe("demoViewFromPath", () => {
	test("uses the final route segment instead of demo id substrings", () => {
		expect(demoViewFromPath("/demo/controller-fixture/delivery")).toBe(
			"delivery",
		);
		expect(demoViewFromPath("/demo/authoring-contract-fixture/source")).toBe(
			"source",
		);
		expect(demoViewFromPath("/demo/multiple-choice/controller")).toBe(
			"controller",
		);
	});

	test("defaults to delivery for the demo root and unknown segments", () => {
		expect(demoViewFromPath("/demo/multiple-choice")).toBe("delivery");
		expect(demoViewFromPath("/demo/multiple-choice/unknown")).toBe("delivery");
	});
});
