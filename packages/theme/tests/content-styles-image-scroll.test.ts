import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const collapsed = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
)
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, "");

describe("image scroll wrapper", () => {
	// Every authored and element-painted image is wrapped, so a block wrapper
	// takes each one out of its line.
	test("keeps the image in its line", () => {
		expect(collapsed).toContain(
			":where([data-pie-content]).pie-image-scroll{display:inline-block;max-width:100%;",
		);
	});

	test("keeps a block image's wrapper a block", () => {
		expect(collapsed).toContain(
			":where([data-pie-content]).pie-image-scroll.pie-image-scroll-block{display:block;}",
		);
	});

	test("still scrolls an image wider than its column", () => {
		expect(collapsed).toContain("overflow-x:auto;overflow-y:hidden;");
		expect(collapsed).toContain(
			":where([data-pie-content]).pie-image-scroll>img{display:block;max-width:none;",
		);
	});
});
