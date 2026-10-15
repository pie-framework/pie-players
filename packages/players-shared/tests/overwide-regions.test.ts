import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { syncOverwideRegions } from "../src/security/wrap-overwide.js";
import {
	TABLE_SPEC,
	wrapOverwideTables,
	wrapOverwideTablesInElement,
} from "../src/security/wrap-overwide-tables.js";

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

function parse(markup: string): HTMLElement {
	const host = document.createElement("div");
	host.innerHTML = markup;
	return host;
}

function setWidths(element: Element, scrollWidth: number, clientWidth: number) {
	Object.defineProperty(element, "scrollWidth", {
		value: scrollWidth,
		configurable: true,
	});
	Object.defineProperty(element, "clientWidth", {
		value: clientWidth,
		configurable: true,
	});
}

describe("vertical margins", () => {
	test("move from the table onto its wrapper", () => {
		const out = parse(
			wrapOverwideTables(
				'<table style="min-width: 325px; margin-top: -12.5px"><tr><td>a</td></tr></table>',
			),
		);
		const wrapper = out.querySelector(".pie-table-scroll") as HTMLElement;
		const table = out.querySelector("table") as HTMLElement;
		expect(wrapper.style.marginTop).toBe("-12.5px");
		expect(table.style.marginTop).toBe("");
		expect(table.style.minWidth).toBe("325px");
	});

	test("split out of the shorthand, leaving horizontal margins on the table", () => {
		const out = parse(
			wrapOverwideTables(
				'<table style="margin: -10px auto 4px"><tr><td>a</td></tr></table>',
			),
		);
		const wrapper = out.querySelector(".pie-table-scroll") as HTMLElement;
		const table = out.querySelector("table") as HTMLElement;
		expect(wrapper.style.marginTop).toBe("-10px");
		expect(wrapper.style.marginBottom).toBe("4px");
		expect(table.style.marginTop).toBe("");
		expect(table.style.marginBottom).toBe("");
		expect(table.style.marginLeft).toBe("auto");
		expect(table.style.marginRight).toBe("auto");
	});

	test("leave no empty style attribute behind", () => {
		const out = wrapOverwideTables(
			'<table style="margin-top: -10px"><tr><td>a</td></tr></table>',
		);
		expect(out).toContain("<table>");
	});

	test("leave a wrapper without margins unstyled", () => {
		const out = wrapOverwideTables("<table><tr><td>a</td></tr></table>");
		expect(out).not.toContain("style=");
	});
});

describe("syncOverwideRegions", () => {
	function wrapped(): { wrapper: HTMLElement; root: HTMLElement } {
		const root = parse(
			"<table><caption>Data</caption><tr><td>a</td></tr></table>",
		);
		document.body.appendChild(root);
		wrapOverwideTablesInElement(root);
		return {
			wrapper: root.querySelector(".pie-table-scroll") as HTMLElement,
			root,
		};
	}

	test("a wrapper starts as a region, the reachable default", () => {
		const { wrapper, root } = wrapped();
		expect(wrapper.getAttribute("tabindex")).toBe("0");
		expect(wrapper.getAttribute("role")).toBe("region");
		root.remove();
	});

	test("drops the region from a wrapper that does not scroll", () => {
		const { wrapper, root } = wrapped();
		setWidths(wrapper, 300, 300);
		syncOverwideRegions([wrapper], TABLE_SPEC);
		expect(wrapper.hasAttribute("tabindex")).toBe(false);
		expect(wrapper.hasAttribute("role")).toBe(false);
		expect(wrapper.hasAttribute("aria-label")).toBe(false);
		root.remove();
	});

	test("restores a named region once the wrapper scrolls", () => {
		const { wrapper, root } = wrapped();
		setWidths(wrapper, 300, 300);
		syncOverwideRegions([wrapper], TABLE_SPEC);
		setWidths(wrapper, 600, 300);
		syncOverwideRegions([wrapper], TABLE_SPEC);
		expect(wrapper.getAttribute("tabindex")).toBe("0");
		expect(wrapper.getAttribute("role")).toBe("region");
		expect(wrapper.getAttribute("aria-label")).toBe("Scrollable table: Data");
		root.remove();
	});

	test("keeps the region on a focused wrapper", () => {
		const { wrapper, root } = wrapped();
		wrapper.focus();
		setWidths(wrapper, 300, 300);
		syncOverwideRegions([wrapper], TABLE_SPEC);
		expect(wrapper.getAttribute("tabindex")).toBe("0");
		root.remove();
	});

	test("leaves elements of another kind alone", () => {
		const root = parse('<div class="pie-image-scroll" tabindex="0"></div>');
		document.body.appendChild(root);
		const other = root.firstElementChild as HTMLElement;
		setWidths(other, 300, 300);
		syncOverwideRegions([other], TABLE_SPEC);
		expect(other.getAttribute("tabindex")).toBe("0");
		root.remove();
	});
});
