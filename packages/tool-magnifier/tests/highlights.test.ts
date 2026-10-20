import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { createCopyMap } from "../src/highlights.js";
import { serializeDocument } from "../src/mirror.js";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

beforeEach(() => {
	document.head.innerHTML = "";
	document.body.innerHTML = "";
});

/**
 * Parses a serialization as the copy's frame does. The test DOM does not attach
 * declarative shadow roots, so their templates are attached here the way a
 * browser's parser does.
 */
function parseCopy(html: string): Document {
	const copy = new DOMParser().parseFromString(html, "text/html");
	const attach = (scope: Document | DocumentFragment) => {
		for (const template of Array.from(
			scope.querySelectorAll<HTMLTemplateElement>("template[shadowrootmode]"),
		)) {
			const host = template.parentElement as Element;
			const root = host.attachShadow({ mode: "open" });
			root.append(...Array.from(template.content.childNodes));
			template.remove();
			attach(root);
		}
	};
	attach(copy);
	return copy;
}

const copyOf = (exclude?: (element: Element) => boolean) => {
	const snapshot = serializeDocument(document, { exclude });
	const copy = parseCopy(snapshot.html);
	return { copy, map: createCopyMap(snapshot.positions, document.body, copy) };
};

const rangeOver = (
	startContainer: Node,
	startOffset: number,
	endContainer: Node,
	endOffset: number,
) => {
	const range = document.createRange();
	range.setStart(startContainer, startOffset);
	range.setEnd(endContainer, endOffset);
	return range;
};

const textOf = (range: StaticRangeInit | null) => {
	if (!range) return null;
	const { startContainer, startOffset, endContainer, endOffset } = range;
	if (startContainer !== endContainer || startContainer.nodeType !== Node.TEXT_NODE) {
		return { startContainer, startOffset, endContainer, endOffset };
	}
	return (startContainer as Text).data.slice(startOffset, endOffset);
};

describe("createCopyMap", () => {
	test("maps a range over text onto the copy's text", () => {
		document.body.innerHTML = "<p>The quick <b>brown</b> fox</p>";
		const word = document.querySelector("b")?.firstChild as Text;
		const { map } = copyOf();

		expect(textOf(map.range(rangeOver(word, 1, word, 4)))).toBe("row");
	});

	test("keeps adjacent text nodes apart in the copy", () => {
		const p = document.createElement("p");
		p.append("one ", "two ", "three");
		document.body.append(p);
		const { copy, map } = copyOf();

		const second = p.childNodes[1] as Text;
		expect(textOf(map.range(rangeOver(second, 0, second, 3)))).toBe("two");
		expect(copy.querySelector("p")?.textContent).toBe("one two three");
	});

	test("keeps text apart across an element the copy leaves out", () => {
		document.body.innerHTML = "<p>before<script>x()</script>after</p>";
		const after = document.querySelector("p")?.lastChild as Text;
		const { map } = copyOf();

		expect(textOf(map.range(rangeOver(after, 0, after, 5)))).toBe("after");
	});

	test("maps text inside an open shadow root", () => {
		const host = document.createElement("x-card");
		host.attachShadow({ mode: "open" }).innerHTML = "<p>inside the card</p>";
		host.append("light");
		document.body.append(host);
		const inside = host.shadowRoot?.querySelector("p")?.firstChild as Text;
		const { map } = copyOf();

		const range = map.range(rangeOver(inside, 7, inside, 10));
		expect(textOf(range)).toBe("the");
		const root = range?.startContainer.getRootNode() as ShadowRoot | undefined;
		expect(root?.host.localName).toBe("x-card");
		expect(textOf(map.range(rangeOver(host.lastChild as Text, 0, host.lastChild as Text, 5)))).toBe(
			"light",
		);
	});

	test("maps a boundary between children past what the copy leaves out", () => {
		document.body.innerHTML = "<div><span>a</span><!-- note --><script></script><em>b</em></div>";
		const div = document.querySelector("div") as HTMLDivElement;
		const { copy, map } = copyOf();

		// Live offsets 1 and 4 fall around the comment and the script.
		const range = map.range(rangeOver(div, 1, div, 4));
		const copyDiv = copy.querySelector("div") as HTMLDivElement;
		expect(range?.startContainer).toBe(copyDiv);
		expect(range?.endContainer).toBe(copyDiv);
		expect(copyDiv.childNodes[range?.startOffset ?? -1] as Node).toBe(
			copyDiv.querySelector("em") as Node,
		);
		expect(range?.endOffset).toBe(copyDiv.childNodes.length);
	});

	test("maps a range over an empty element", () => {
		document.body.innerHTML = "<p></p>";
		const p = document.querySelector("p") as HTMLParagraphElement;
		const { copy, map } = copyOf();

		const range = map.range(rangeOver(p, 0, p, 0));
		expect(range?.startContainer).toBe(copy.querySelector("p") as Node);
	});

	test("drops a range over text edited since the copy was taken", () => {
		document.body.innerHTML = "<p>stale</p>";
		const text = document.querySelector("p")?.firstChild as Text;
		const { map } = copyOf();
		text.data = "fresh text";

		expect(map.range(rangeOver(text, 0, text, 5))).toBeNull();
	});

	test("drops a range over nodes the copy does not hold", () => {
		document.body.innerHTML = '<p>page</p><div id="lens">lens</div>';
		const lens = document.getElementById("lens") as HTMLDivElement;
		const { map } = copyOf((element) => element === lens);
		const added = document.createElement("p");
		added.textContent = "added later";
		document.body.append(added);

		expect(map.range(rangeOver(lens.firstChild as Text, 0, lens.firstChild as Text, 4))).toBeNull();
		const later = added.firstChild as Text;
		expect(map.range(rangeOver(later, 0, later, 5))).toBeNull();
	});

	test("finds nothing where the parser moved what the DOM held", () => {
		// A block inside a paragraph, which only the DOM can build: the parser
		// closes the paragraph before the block.
		const p = document.createElement("p");
		const block = document.createElement("div");
		block.textContent = "moved";
		p.append("lead ", block);
		const next = document.createElement("span");
		next.textContent = "next";
		document.body.append(p, next);
		const { map } = copyOf();

		expect(textOf(map.range(rangeOver(p.firstChild as Text, 0, p.firstChild as Text, 4)))).toBe(
			"lead",
		);
		expect(map.node(block)).toBeNull();
		expect(map.node(next)).toBeNull();
	});
});

describe("serializeDocument for highlights", () => {
	test("writes a leading newline twice where the parser swallows one", () => {
		const pre = document.createElement("pre");
		pre.textContent = "\nline";
		document.body.append(pre);

		expect(serializeDocument(document).html).toInclude("<pre>\n\nline</pre>");
	});

	test("records the sheets each root had adopted", () => {
		const sheet = new CSSStyleSheet();
		const host = document.createElement("x-card");
		const root = host.attachShadow({ mode: "open" });
		root.adoptedStyleSheets = [sheet];
		document.body.append(host);

		expect(serializeDocument(document).adoptedSheets.get(root)).toEqual([sheet]);
	});
});
