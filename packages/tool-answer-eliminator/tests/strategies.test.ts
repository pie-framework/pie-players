import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { CrossStrategy } = await import("../strategies/cross-strategy");
const { MaskStrategy } = await import("../strategies/mask-strategy");
const { StrikethroughStrategy } = await import(
	"../strategies/strikethrough-strategy"
);

const FALLBACK_CLASS = "pie-answer-eliminator-eliminated-fallback";
const originalCSS = globalThis.CSS;
const originalMatchMedia = globalThis.matchMedia;

// happy-dom has neither `Highlight` nor `CSS.highlights`.
const stubHighlightApi = () => {
	class Highlight {
		constructor(..._ranges: unknown[]) {}
	}
	Object.defineProperty(globalThis, "Highlight", {
		value: Highlight,
		configurable: true,
	});
	Object.defineProperty(globalThis, "CSS", {
		value: { highlights: new Map<string, unknown>() },
		configurable: true,
	});
};

/** A `(forced-colors: active)` query the test turns on and off. */
const stubForcedColors = (active: boolean) => {
	const listeners = new Set<() => void>();
	const query = {
		matches: active,
		addEventListener: (_type: string, listener: () => void) =>
			listeners.add(listener),
		removeEventListener: (_type: string, listener: () => void) =>
			listeners.delete(listener),
	};
	Object.defineProperty(globalThis, "matchMedia", {
		value: () => query,
		configurable: true,
	});
	return (next: boolean) => {
		query.matches = next;
		for (const listener of listeners) listener();
	};
};

afterEach(() => {
	Object.defineProperty(globalThis, "CSS", {
		value: originalCSS,
		configurable: true,
	});
	delete (globalThis as { Highlight?: unknown }).Highlight;
	Object.defineProperty(globalThis, "matchMedia", {
		value: originalMatchMedia,
		configurable: true,
	});
	document.head.replaceChildren();
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

/** A choice as the core hands it to a strategy, its toggle already mounted. */
function choice(id: string, html = `Choice ${id}`, contentTag = "label") {
	const container = document.createElement("div");
	const content = document.createElement(contentTag);
	content.innerHTML = html;
	const toggle = document.createElement("button");
	toggle.className = "pie-answer-eliminator-toggle";
	container.append(content, toggle);
	document.body.append(container);
	const range = document.createRange();
	range.selectNodeContents(content);
	return { container, content, toggle, target: { range, container, content } };
}

const rect = (left: number, top: number, width: number, height: number) =>
	({ left, top, width, height }) as DOMRect;

/** Lays a container out at the origin, untransformed: happy-dom does no layout. */
function layOut(container: HTMLElement, width = 300, height = 40) {
	container.getBoundingClientRect = () => rect(0, 0, width, height);
	Object.defineProperty(container, "offsetWidth", { value: width });
	Object.defineProperty(container, "offsetHeight", { value: height });
}

for (const Strategy of [StrikethroughStrategy, CrossStrategy, MaskStrategy]) {
	test(`${Strategy.name} tracks eliminations and leaves the eliminated state to the core`, () => {
		const strategy = new Strategy();
		strategy.initialize();
		const a = choice("a");
		const b = choice("b");

		strategy.apply("a", a.target);
		strategy.apply("b", b.target);
		expect(strategy.isEliminated("a")).toBe(true);
		expect(strategy.getEliminatedIds().sort()).toEqual(["a", "b"]);
		for (const { container, toggle } of [a, b]) {
			expect(container.hasAttribute("data-pie-answer-eliminated")).toBe(false);
			expect(container.hasAttribute("aria-disabled")).toBe(false);
			expect(
				container.querySelector(".pie-answer-eliminator-sr-announcement"),
			).toBe(null);
			expect(toggle.getAttributeNames()).toEqual(["class"]);
		}

		strategy.remove("a");
		expect(strategy.isEliminated("a")).toBe(false);
		strategy.destroy();
		expect(strategy.getEliminatedIds()).toEqual([]);
		for (const { container, content } of [a, b]) {
			expect(content.getAttribute("class")).toBeFalsy();
			expect(container.getAttribute("style")).toBeFalsy();
			expect(container.lastElementChild?.localName).toBe("button");
		}
	});
}

test("strikethrough strikes text with a custom highlight where it can", () => {
	stubHighlightApi();
	const strategy = new StrikethroughStrategy();
	strategy.initialize();
	const a = choice("a");

	strategy.apply("a", a.target);
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(true);
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(false);
	const rule = document.getElementById("pie-answer-eliminator-highlight-a");
	expect(rule?.textContent).toContain("var(--pie-fixed-hue-collapse, 0%)");

	strategy.remove("a");
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(false);
	expect(document.getElementById("pie-answer-eliminator-highlight-a")).toBe(
		null,
	);
});

test("strikethrough falls back to a class on the content without the API", () => {
	Object.defineProperty(globalThis, "CSS", { value: {}, configurable: true });
	const strategy = new StrikethroughStrategy();
	strategy.initialize();
	const a = choice("a");

	strategy.apply("a", a.target);
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(true);
	expect(a.container.classList.contains(FALLBACK_CLASS)).toBe(false);
	strategy.remove("a");
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(false);
});

test("strikethrough leaves the highlight while forced colours are on", () => {
	stubHighlightApi();
	const setForcedColors = stubForcedColors(true);
	const strategy = new StrikethroughStrategy();
	strategy.initialize();
	const a = choice("a");

	// Chromium paints a highlight as a selection in forced colours.
	strategy.apply("a", a.target);
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(false);
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(true);

	setForcedColors(false);
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(true);
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(false);

	setForcedColors(true);
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(false);
	expect(a.content.classList.contains(FALLBACK_CLASS)).toBe(true);

	strategy.destroy();
	setForcedColors(false);
	expect(CSS.highlights.has("pie-answer-eliminated-a")).toBe(false);
});

test("strikethrough crosses out images and stacked math with SVG marks", () => {
	Object.defineProperty(globalThis, "CSS", { value: {}, configurable: true });
	const strategy = new StrikethroughStrategy();
	const a = choice(
		"a",
		'<img src="a.png" alt="A"><mjx-container><mjx-math><mjx-mfrac></mjx-mfrac></mjx-math></mjx-container><mjx-container><mjx-math></mjx-math></mjx-container>',
	);

	strategy.apply("a", a.target);
	const wrapper = a.content.querySelector(".pie-answer-eliminator-image-strike");
	expect(wrapper?.querySelector("img")).not.toBe(null);
	const [stacked, row] = Array.from(a.content.querySelectorAll("mjx-math"));
	expect(stacked.getAttribute("data-pie-answer-eliminator-math-strike")).toBe(
		"cross",
	);
	expect(row.getAttribute("data-pie-answer-eliminator-math-strike")).toBe(
		"line",
	);
	// Forced colours keep SVG strokes, where they drop gradients.
	for (const mark of [
		wrapper?.querySelector("svg"),
		stacked.querySelector("svg"),
	]) {
		expect(mark?.getAttribute("aria-hidden")).toBe("true");
		expect(mark?.querySelectorAll("line")).toHaveLength(
			mark === stacked.querySelector("svg") ? 2 : 4,
		);
	}
	expect(row.querySelector("svg")).toBe(null);

	strategy.remove("a");
	expect(a.content.innerHTML).toBe(
		'<img src="a.png" alt="A"><mjx-container><mjx-math class=""><mjx-mfrac></mjx-mfrac></mjx-math></mjx-container><mjx-container><mjx-math class=""></mjx-math></mjx-container>',
	);
});

test("mask dims the content through a class, which a highlight cannot carry", () => {
	stubHighlightApi();
	const strategy = new MaskStrategy();
	const a = choice("a");

	strategy.apply("a", a.target);
	expect(a.content.classList.contains("pie-answer-eliminator-masked")).toBe(
		true,
	);
	expect(CSS.highlights.size).toBe(0);
	strategy.remove("a");
	expect(a.content.classList.contains("pie-answer-eliminator-masked")).toBe(
		false,
	);
});

test("cross draws an X over block content, after the toggle", () => {
	const strategy = new CrossStrategy();
	const a = choice("a", "Choice a", "div");
	// happy-dom computes no default `position`.
	a.container.style.position = "static";
	layOut(a.container);
	a.content.getBoundingClientRect = () => rect(10, 5, 200, 30);

	strategy.apply("a", a.target);
	const mark = a.container.lastElementChild as SVGSVGElement;
	expect(mark.getAttribute("data-pie-answer-eliminator-cross")).toBe("cross");
	expect(mark.previousElementSibling).toBe(a.toggle);
	expect(mark.getAttribute("aria-hidden")).toBe("true");
	expect(mark.classList.contains("pie-answer-eliminator-cross--wipe")).toBe(
		true,
	);
	expect(mark.querySelectorAll(".pie-answer-eliminator-cross-line")).toHaveLength(
		2,
	);
	expect(
		[mark.style.left, mark.style.top, mark.style.width, mark.style.height],
	).toEqual(["10px", "5px", "200px", "30px"]);
	// Positioned against the container, which was static.
	expect(a.container.style.position).toBe("relative");

	strategy.remove("a");
	expect(a.container.querySelector("svg")).toBe(null);
	expect(a.container.style.position).toBe("static");
});

test("cross strikes each line box of inline content", () => {
	const strategy = new CrossStrategy();
	const a = choice("a", "a token that wraps", "span");
	a.content.style.display = "inline";
	a.content.dir = "rtl";
	a.content.style.direction = "rtl";
	layOut(a.container, 300, 60);
	a.content.getClientRects = () =>
		[rect(200, 0, 100, 20), rect(0, 20, 80, 20)] as unknown as DOMRectList;

	strategy.apply("a", a.target);
	const marks = Array.from(
		a.container.querySelectorAll<SVGSVGElement>("[data-pie-answer-eliminator-cross]"),
	);
	expect(marks.map((mark) => mark.getAttribute("data-pie-answer-eliminator-cross"))).toEqual(
		["line", "line"],
	);
	expect(marks.map((mark) => mark.querySelectorAll("line").length)).toEqual([
		2, 2,
	]);
	// The wipe mirrors under right-to-left content.
	expect(marks.map((mark) => mark.getAttribute("dir"))).toEqual(["rtl", "rtl"]);
	expect(marks.map((mark) => [mark.style.left, mark.style.top])).toEqual([
		["200px", "0px"],
		["0px", "20px"],
	]);
});
