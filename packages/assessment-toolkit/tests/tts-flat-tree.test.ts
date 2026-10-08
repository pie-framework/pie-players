import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import {
	composedClosest,
	composedContains,
	composedParentElement,
	flatQuerySelectorAll,
	flatTextContent,
	flatTreeClosest,
	flatTreeTextNodes,
	isShadowRootNode,
	rangeHoldsTextPosition,
	rangeIntersectsComposedNode,
	retargetToTree,
} from "../src/services/tts/flat-tree";
import {
	createRangeFromVisibleMap,
	createRangesFromVisibleMap,
} from "../src/services/tts/highlight-pipeline/visible-map-range";
import { collectVisibleTextAndMap } from "../src/services/tts/text-processing";

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

afterEach(() => {
	document.body.innerHTML = "";
});

/** A host under `parent` whose open shadow root holds `shadowMarkup`. */
const shadowHost = (
	parent: Element,
	shadowMarkup: string,
	lightMarkup = "",
	tag = "div",
): { host: Element; root: ShadowRoot } => {
	const host = document.createElement(tag);
	host.innerHTML = lightMarkup;
	parent.appendChild(host);
	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = shadowMarkup;
	return { host, root };
};

const words = (root: Node): string =>
	flatTextContent(root).replace(/\s+/g, " ").trim();

describe("flat tree walk", () => {
	test("reads a shadow root in place of its host's light children, and slotted children at the slot", () => {
		const content = document.createElement("div");
		content.innerHTML = "<p>before</p>";
		document.body.appendChild(content);
		shadowHost(
			content,
			"<p>shadow one</p><p><slot></slot></p><p>shadow two</p>",
			"<em>slotted</em>",
		);
		content.insertAdjacentHTML("beforeend", "<p>after</p>");

		expect(words(content)).toBe("beforeshadow oneslottedshadow twoafter");
	});

	test("descends nested open shadow roots", () => {
		const content = document.createElement("div");
		document.body.appendChild(content);
		const { root } = shadowHost(content, "<p>outer</p>");
		shadowHost(root as unknown as Element, "<p>inner</p>");

		expect(words(content)).toBe("outerinner");
	});

	test("leaves out toolkit chrome, shell anchors and unrendered text", () => {
		const content = document.createElement("div");
		content.innerHTML =
			"<pie-item-toolbar>toolbar</pie-item-toolbar><pie-tool-tts-inline>tool</pie-tool-tts-inline><style>p{}</style><p>kept</p>";
		document.body.appendChild(content);
		shadowHost(
			content,
			'<div aria-hidden="true">anchor</div><slot></slot>',
			"<p>shell content</p>",
		);
		shadowHost(
			content,
			"<button>Play</button>",
			"",
			"pie-section-player-tools-tts",
		);

		expect(words(content)).toBe("keptshell content");
	});

	test("keeps an aria-hidden element that is not a shadow root's own child", () => {
		const content = document.createElement("div");
		document.body.appendChild(content);
		shadowHost(
			content,
			'<p><span aria-hidden="true">decorative</span> text</p>',
		);

		expect(words(content)).toBe("decorative text");
	});

	test("finds elements in shadow roots in rendering order", () => {
		const content = document.createElement("div");
		content.innerHTML = '<span data-mark="1"></span>';
		document.body.appendChild(content);
		shadowHost(content, '<span data-mark="2"></span>');
		content.insertAdjacentHTML("beforeend", '<span data-mark="3"></span>');

		expect(
			flatQuerySelectorAll(content, "[data-mark]").map((element) =>
				element.getAttribute("data-mark"),
			),
		).toEqual(["1", "2", "3"]);
	});

	test("climbs from shadow text to the host's ancestors", () => {
		const content = document.createElement("section");
		content.className = "region";
		document.body.appendChild(content);
		const { host, root } = shadowHost(content, "<p><b>bold</b></p>");
		const text = flatTreeTextNodes(content)[0];

		expect(isShadowRootNode(root)).toBe(true);
		expect(isShadowRootNode(host)).toBe(false);
		expect(composedParentElement(root.firstElementChild as Element)).toBe(host);
		expect(composedClosest(text, ".region")).toBe(content);
		expect(flatTreeClosest(text, ".region")).toBe(content);
		expect(composedClosest(text, ".region", host)).toBeNull();
	});

	test("contains and retargets across shadow boundaries", () => {
		const content = document.createElement("div");
		const outside = document.createElement("div");
		document.body.append(content, outside);
		const { host, root } = shadowHost(content, "<p>inside</p>");
		const text = flatTreeTextNodes(content)[0];

		expect(content.contains(text)).toBe(false);
		expect(composedContains(content, text)).toBe(true);
		expect(composedContains(outside, text)).toBe(false);
		expect(retargetToTree(text, document)).toBe(host);
		expect(retargetToTree(text, root)).toBe(text);
		expect(retargetToTree(content, root)).toBeNull();
	});
});

describe("ranges over shadow content", () => {
	test("a range holding a shadow host holds the text inside it", () => {
		const content = document.createElement("div");
		content.innerHTML = "<p>light</p>";
		document.body.appendChild(content);
		const { host } = shadowHost(content, "<p>inside</p>");
		const [, inside] = flatTreeTextNodes(content);

		const whole = document.createRange();
		whole.selectNodeContents(content);
		expect(rangeHoldsTextPosition(whole, inside, 0)).toBe(true);
		expect(rangeIntersectsComposedNode(whole, inside)).toBe(true);

		const lightOnly = document.createRange();
		lightOnly.setStartBefore(content.firstChild as Node);
		lightOnly.setEndBefore(host);
		expect(rangeHoldsTextPosition(lightOnly, inside, 0)).toBe(false);
		expect(rangeIntersectsComposedNode(lightOnly, inside)).toBe(false);
	});

	test("maps visible text through shadow roots and splits its ranges per tree", () => {
		const content = document.createElement("div");
		content.innerHTML = "<p>alpha</p>";
		document.body.appendChild(content);
		const { root } = shadowHost(content, "<p>beta</p>");
		content.insertAdjacentHTML("beforeend", "<p>gamma</p>");

		const { text, map } = collectVisibleTextAndMap(content);
		expect(text).toBe("alpha beta gamma");

		const ranges = createRangesFromVisibleMap(map, 0, text.length);
		expect(ranges.map((range) => range.toString())).toEqual([
			"alpha",
			"beta",
			"gamma",
		]);
		expect(ranges[1].startContainer.getRootNode()).toBe(root);

		const single = createRangeFromVisibleMap(map, 0, text.length);
		expect(single?.startContainer.getRootNode()).toBe(document);
		expect(createRangesFromVisibleMap(map, 6, 10).map(String)).toEqual([
			"beta",
		]);
	});

	test("a range inside a shadow root compares points in its own tree", () => {
		const content = document.createElement("div");
		document.body.appendChild(content);
		const { root } = shadowHost(content, "<p>one</p><p>two</p>");
		const [one, two] = flatTreeTextNodes(content);

		const range = document.createRange();
		range.selectNodeContents(root.firstElementChild as Element);
		expect(rangeHoldsTextPosition(range, one, 1)).toBe(true);
		expect(rangeHoldsTextPosition(range, two, 1)).toBe(false);
	});
});
