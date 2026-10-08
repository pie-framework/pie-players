/**
 * Several toolkits on one page share the page's named highlights, so each
 * coordinator paints into the registered highlight and clears only its own
 * ranges.
 */
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
	HighlightColor,
	HighlightCoordinator,
} from "../src/services/HighlightCoordinator";

class SetHighlight extends Set<Range> {}

let highlights: Map<string, SetHighlight>;
let savedCss: PropertyDescriptor | undefined;
let savedHighlight: PropertyDescriptor | undefined;

const define = (name: string, value: unknown) =>
	Object.defineProperty(globalThis, name, {
		value,
		configurable: true,
		writable: true,
	});

const textIn = (text: string, parent: Element = document.body): Text => {
	const paragraph = document.createElement("p");
	paragraph.textContent = text;
	parent.append(paragraph);
	return paragraph.firstChild as Text;
};

const rangeOver = (node: Text): Range => {
	const range = document.createRange();
	range.selectNodeContents(node);
	return range;
};

const painted = (name: string): string[] =>
	[...(highlights.get(name) ?? [])].map((range) => range.toString());

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
	savedCss = Object.getOwnPropertyDescriptor(globalThis, "CSS");
	savedHighlight = Object.getOwnPropertyDescriptor(globalThis, "Highlight");
});

afterEach(() => {
	document.body.replaceChildren();
	document.getElementById("pie-highlight-styles")?.remove();
	document.documentElement.removeAttribute("style");
	document.documentElement.removeAttribute("data-theme");
	for (const [name, descriptor] of [
		["CSS", savedCss],
		["Highlight", savedHighlight],
	] as const) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else delete (globalThis as Record<string, unknown>)[name];
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const installHighlights = () => {
	highlights = new Map();
	define("CSS", { highlights });
	define("Highlight", SetHighlight);
};

describe("HighlightCoordinator highlight ownership", () => {
	test("a second coordinator paints into the highlights the first registered", () => {
		installHighlights();
		const first = new HighlightCoordinator();
		const second = new HighlightCoordinator();

		first.highlightTTSWord(textIn("first"), 0, "first".length);
		second.highlightTTSWord(textIn("second"), 0, "second".length);

		expect(painted("tts-word").sort()).toEqual(["first", "second"]);
		first.destroy();
		second.destroy();
	});

	test("clearing one coordinator keeps the other's read-aloud and annotations", () => {
		installHighlights();
		const first = new HighlightCoordinator();
		const second = new HighlightCoordinator();
		first.highlightTTSSentence([rangeOver(textIn("first sentence"))]);
		second.highlightTTSSentence([rangeOver(textIn("second sentence"))]);
		first.addAnnotation(rangeOver(textIn("first note")), HighlightColor.YELLOW);
		second.addAnnotation(
			rangeOver(textIn("second note")),
			HighlightColor.YELLOW,
		);

		first.clearTTS();
		first.clearAnnotations();

		expect(painted("tts-sentence")).toEqual(["second sentence"]);
		expect(painted("annotation-yellow")).toEqual(["second note"]);
		second.destroy();
		first.destroy();
	});
});

describe("HighlightCoordinator theme refresh", () => {
	test("keeps the colors adapted to the content being read", async () => {
		installHighlights();
		const coordinator = new HighlightCoordinator();
		const word = textIn("green");
		(word.parentElement as HTMLElement).style.setProperty(
			"--pie-missing",
			"rgb(0, 128, 0)",
		);

		coordinator.highlightTTSWord(word, 0, "green".length);
		const adapted = document.documentElement.style.getPropertyValue(
			"--pie-tts-word-highlight",
		);
		expect(adapted).toStartWith("rgba(0, 128, 0,");

		document.documentElement.setAttribute("data-theme", "dark");
		await new Promise((resolve) => setTimeout(resolve, 5));

		expect(
			document.documentElement.style.getPropertyValue(
				"--pie-tts-word-highlight",
			),
		).toBe(adapted);
		coordinator.destroy();
	});

	test("two coordinators agree on the colors after a theme change", async () => {
		installHighlights();
		const style = document.documentElement.style;
		const setProperty = style.setProperty.bind(style);
		let writes = 0;
		// Two observers that disagree would rewrite each other's colors forever.
		style.setProperty = (name: string, value: string | null) => {
			writes += 1;
			if (writes > 100) throw new Error("the coordinators keep rewriting");
			setProperty(name, value);
		};
		try {
			const reading = new HighlightCoordinator();
			const idle = new HighlightCoordinator();
			const word = textIn("green");
			(word.parentElement as HTMLElement).style.setProperty(
				"--pie-missing",
				"rgb(0, 128, 0)",
			);
			reading.highlightTTSWord(word, 0, "green".length);

			document.documentElement.setAttribute("data-theme", "dark");
			await new Promise((resolve) => setTimeout(resolve, 20));

			expect(writes).toBeLessThan(100);
			expect(style.getPropertyValue("--pie-tts-word-highlight")).toStartWith(
				"rgba(0, 128, 0,",
			);
			reading.destroy();
			idle.destroy();
		} finally {
			Reflect.deleteProperty(style, "setProperty");
		}
	});
});
