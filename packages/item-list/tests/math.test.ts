import { describe, expect, test } from "bun:test";
import { convertMath } from "../src/math.js";

describe("convertMath", () => {
	test("converts TeX to MathML with the real converter", async () => {
		const html = await convertMath("<p>Solve \\(x^2 = 4\\).</p>");
		expect(html).toContain("<math");
		expect(html).not.toContain("\\(");
	});

	test("loads nothing for HTML without TeX", async () => {
		let loads = 0;
		const html = await convertMath("<p>Plain $5 text</p>", async () => {
			loads += 1;
			return (source) => source;
		});
		expect(html).toBe("<p>Plain $5 text</p>");
		expect(loads).toBe(0);
	});
});

// The converter is cached per module, so these run against a fresh copy.
describe("convertMath with a failing converter", () => {
	test("returns the source and retries the load on the next conversion", async () => {
		const fresh: typeof import("../src/math.js") = await import(
			`../src/math.js?failing=${Date.now()}`
		);
		const convert = fresh.convertMath;
		let loads = 0;
		const failing = async () => {
			loads += 1;
			throw new Error("offline");
		};
		expect(await convert("\\(a\\)", failing)).toBe("\\(a\\)");
		expect(await convert("\\(b\\)", async () => (source: string) => `<math>${source}</math>`)).toBe(
			"<math>\\(b\\)</math>",
		);
		expect(loads).toBe(1);
	});
});
