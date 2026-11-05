import { describe, expect, test } from "bun:test";

import {
	collectMarkupClasses,
	findLightDomClassViolations,
	isAllowedLightDomClass,
} from "../check-light-dom-classes.mjs";

const names = (source) => collectMarkupClasses(source).map(({ name }) => name);

describe("check-light-dom-classes", () => {
	test("reads static tokens, expression literals and class directives", () => {
		const source = `<script>const x = "btn";</script>
<div class="pie-a btn {open ? 'pie-b' : 'active'}" class:danger={bad}></div>
<style>.btn {}</style>`;
		expect(names(source)).toEqual(["pie-a", "btn", "pie-b", "active", "danger"]);
	});

	test("ignores script, style and comments, and keeps line numbers", () => {
		const source = `<script>
	const markup = '<p class="btn"></p>';
</script>
<!-- <p class="btn"></p> -->
<p class="pie-x"></p>`;
		expect(collectMarkupClasses(source)).toEqual([{ name: "pie-x", line: 5 }]);
	});

	test("accepts the pie- namespace and the listed platform hooks only", () => {
		expect(isAllowedLightDomClass("pie-tool__x")).toBe(true);
		expect(isAllowedLightDomClass("notranslate")).toBe(true);
		expect(isAllowedLightDomClass("btn-sm")).toBe(false);
		expect(isAllowedLightDomClass("active")).toBe(false);
	});

	test("the repository's light-DOM elements pass, and the scan reaches them", () => {
		const { elements, scanned, violations } = findLightDomClassViolations();
		expect(violations).toEqual([]);
		// Positive control: an empty scan would also report no violations.
		expect(elements).toBeGreaterThan(10);
		expect(scanned).toBeGreaterThan(elements);
	});
});
