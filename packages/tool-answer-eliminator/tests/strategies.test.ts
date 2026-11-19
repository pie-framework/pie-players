import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { CrossStrategy } = await import("../strategies/cross-strategy");
const { MaskStrategy } = await import("../strategies/mask-strategy");
const { StrikethroughStrategy } = await import(
	"../strategies/strikethrough-strategy"
);

const { own } = await import("../owned-nodes");

const originalClientRects = Range.prototype.getClientRects;
/** Each text node's line fragments: happy-dom lays no text out. */
const textRects = new Map<Node, DOMRect[]>();

Range.prototype.getClientRects = function (this: Range) {
	return (textRects.get(this.startContainer) ?? []) as unknown as DOMRectList;
};

afterEach(() => {
	textRects.clear();
	document.head.replaceChildren();
	document.body.replaceChildren();
});

afterAll(() => {
	Range.prototype.getClientRects = originalClientRects;
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

/** The text node of `element` that reads `text`. */
function textNode(element: Element, text: string): Text {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node.nodeValue === text) return node as Text;
	}
	throw new Error(`no text node "${text}"`);
}

const position = (mark: SVGSVGElement) => [
	mark.style.left,
	mark.style.top,
	mark.style.width,
	mark.style.height,
];

const strikeMarks = (container: Element) =>
	Array.from(
		container.querySelectorAll<SVGSVGElement>(
			"[data-pie-answer-eliminator-strike]",
		),
	);

test("strikethrough draws a line through each line of text, outside the content", () => {
	const strategy = new StrikethroughStrategy();
	const a = choice("a", "Choice <b>a</b> wraps");
	layOut(a.container, 300, 60);
	textRects.set(textNode(a.content, "Choice "), [rect(10, 5, 50, 20)]);
	textRects.set(textNode(a.content, "a"), [rect(60, 5, 10, 20)]);
	textRects.set(textNode(a.content, " wraps"), [
		rect(70, 5, 40, 20),
		rect(10, 25, 30, 20),
	]);

	strategy.apply("a", a.target);
	const marks = strikeMarks(a.container);
	// A line's fragments join into one mark, across the element boundary.
	expect(marks.map(position)).toEqual([
		["10px", "5px", "100px", "20px"],
		["10px", "25px", "30px", "20px"],
	]);
	for (const mark of marks) {
		expect(mark.getAttribute("data-pie-answer-eliminator-strike")).toBe("line");
		expect(mark.getAttribute("aria-hidden")).toBe("true");
		expect(mark.parentElement).toBe(a.container);
		expect(mark.querySelectorAll(".pie-answer-eliminator-strike-line")).toHaveLength(
			1,
		);
	}
	expect(a.container.lastElementChild).toBe(a.toggle);
	// Outside the content, so its dim does not reach the strike, and the
	// element's markup stays as it rendered it.
	expect(a.content.innerHTML).toBe("Choice <b>a</b> wraps");

	strategy.remove("a");
	expect(strikeMarks(a.container)).toEqual([]);
});

test("strikethrough crosses out images and stacked math, and strikes a row of math", () => {
	const strategy = new StrikethroughStrategy();
	const html =
		'<img src="a.png" alt="A"><mjx-container><mjx-math><mjx-mfrac></mjx-mfrac></mjx-math><mjx-assistive-mml>1/2</mjx-assistive-mml></mjx-container><mjx-container><mjx-math></mjx-math></mjx-container>';
	const a = choice("a", html);
	layOut(a.container, 300, 60);
	const [stacked, row] = Array.from(a.content.querySelectorAll("mjx-math"));
	a.content.querySelector("img")!.getBoundingClientRect = () =>
		rect(0, 0, 40, 40);
	stacked.getBoundingClientRect = () => rect(50, 0, 20, 40);
	row.getBoundingClientRect = () => rect(80, 10, 30, 20);
	// MathJax's assistive MathML is visually hidden; the box is struck instead.
	textRects.set(textNode(a.content, "1/2"), [rect(50, 0, 1, 1)]);

	strategy.apply("a", a.target);
	const marks = strikeMarks(a.container);
	expect(
		marks.map((mark) => [
			mark.getAttribute("data-pie-answer-eliminator-strike"),
			mark.querySelectorAll("line").length,
			position(mark),
		]),
	).toEqual([
		// The image's X lies over a casing that keeps it clear of dark artwork.
		["cross", 4, ["0px", "0px", "40px", "40px"]],
		// A fraction bar would read as part of a line, so the fraction is crossed.
		["cross", 2, ["50px", "0px", "20px", "40px"]],
		["line", 1, ["80px", "10px", "30px", "20px"]],
	]);
	expect(
		marks[0].querySelectorAll(".pie-answer-eliminator-image-strike-casing"),
	).toHaveLength(2);
	expect(a.content.innerHTML).toBe(html);
});

test("strikethrough strikes only text the learner sees", () => {
	const strategy = new StrikethroughStrategy();
	const a = choice(
		"a",
		'Seen<span style="visibility: hidden">hidden</span><span style="opacity: 0">clear</span><span style="position: absolute; width: 1px; height: 1px; overflow: hidden">clipped</span><span class="added">added</span>',
	);
	own(a.content.querySelector(".added")!);
	layOut(a.container, 300, 60);
	for (const [text, left] of [
		["Seen", 0],
		["hidden", 40],
		["clear", 80],
		["clipped", 120],
		["added", 160],
	] as const) {
		textRects.set(textNode(a.content, text), [rect(left, 30, 30, 20)]);
	}

	strategy.apply("a", a.target);
	expect(strikeMarks(a.container).map(position)).toEqual([
		["0px", "30px", "30px", "20px"],
	]);
});

test("strikethrough lays its marks out again as the content reflows", () => {
	const strategy = new StrikethroughStrategy();
	const a = choice("a", "A choice that wraps");
	layOut(a.container, 300, 60);
	const text = textNode(a.content, "A choice that wraps");
	textRects.set(text, [rect(0, 0, 200, 20)]);

	strategy.apply("a", a.target);
	const [mark] = strikeMarks(a.container);

	// Narrower: the same mark moves.
	textRects.set(text, [rect(10, 0, 150, 20)]);
	strategy.relayout();
	expect(strikeMarks(a.container)).toEqual([mark]);
	expect(position(mark)).toEqual(["10px", "0px", "150px", "20px"]);

	// Wrapped onto a second line: a mark per line.
	textRects.set(text, [rect(0, 0, 100, 20), rect(0, 20, 60, 20)]);
	strategy.relayout();
	expect(strikeMarks(a.container).map(position)).toEqual([
		["0px", "0px", "100px", "20px"],
		["0px", "20px", "60px", "20px"],
	]);
});

test("mask dims the content through a class", () => {
	const strategy = new MaskStrategy();
	const a = choice("a");

	strategy.apply("a", a.target);
	expect(a.content.classList.contains("pie-answer-eliminator-masked")).toBe(
		true,
	);
	strategy.remove("a");
	expect(a.content.classList.contains("pie-answer-eliminator-masked")).toBe(
		false,
	);
});

test("cross draws an X over block content, ahead of the toggle", () => {
	const strategy = new CrossStrategy();
	const a = choice("a", "Choice a", "div");
	// happy-dom computes no default `position`.
	a.container.style.position = "static";
	layOut(a.container);
	a.content.getBoundingClientRect = () => rect(10, 5, 200, 30);

	strategy.apply("a", a.target);
	const mark = a.toggle.previousElementSibling as SVGSVGElement;
	expect(a.container.lastElementChild).toBe(a.toggle);
	expect(mark.getAttribute("data-pie-answer-eliminator-cross")).toBe("cross");
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

test("cross moves its marks with the content, wiping in only once", () => {
	const strategy = new CrossStrategy();
	const a = choice("a", "Choice a", "div");
	layOut(a.container);
	a.content.getBoundingClientRect = () => rect(10, 5, 200, 30);

	strategy.apply("a", a.target);
	a.content.getBoundingClientRect = () => rect(10, 5, 120, 30);
	strategy.relayout();
	const [mark] = Array.from(
		a.container.querySelectorAll<SVGSVGElement>("[data-pie-answer-eliminator-cross]"),
	);
	expect(position(mark)).toEqual(["10px", "5px", "120px", "30px"]);

	// Turned inline: a line per line box, which never wipes in again.
	a.content.style.display = "inline";
	a.content.getClientRects = () =>
		[rect(10, 5, 100, 20), rect(0, 25, 40, 20)] as unknown as DOMRectList;
	strategy.relayout();
	const lines = Array.from(
		a.container.querySelectorAll<SVGSVGElement>("[data-pie-answer-eliminator-cross]"),
	);
	expect(lines.map((line) => line.getAttribute("data-pie-answer-eliminator-cross"))).toEqual(
		["line", "line"],
	);
	expect(
		lines.some((line) => line.classList.contains("pie-answer-eliminator-cross--wipe")),
	).toBe(false);
});
