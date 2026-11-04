import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { MaskStrategy } = await import("../strategies/mask-strategy");
const { StrikethroughStrategy } = await import(
	"../strategies/strikethrough-strategy"
);

const originalCSS = globalThis.CSS;

// The CSS Custom Highlight API path needs `Highlight` and `CSS.highlights`;
// happy-dom provides neither, so both are stubbed.
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

const restoreCSS = () => {
	Object.defineProperty(globalThis, "CSS", {
		value: originalCSS,
		configurable: true,
	});
	delete (globalThis as { Highlight?: unknown }).Highlight;
};

afterEach(() => {
	restoreCSS();
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

function choiceRange(id: string): { choice: HTMLElement; range: Range } {
	const choice = document.createElement("div");
	choice.setAttribute("data-pie-answer-eliminator-choice", "true");
	choice.innerHTML = `<label>Choice ${id}</label>`;
	document.body.append(choice);
	const range = document.createRange();
	range.selectNodeContents(choice.querySelector("label") as HTMLElement);
	// The core appends its toggle to the choice container — the element a
	// container-level aria-hidden would hide along with the answer.
	const button = document.createElement("button");
	button.className = "pie-answer-eliminator-toggle";
	choice.appendChild(button);
	return { choice, range };
}

for (const Strategy of [StrikethroughStrategy, MaskStrategy]) {
	for (const highlightApi of [true, false]) {
		test(`${Strategy.name} keeps the choice and its toggle exposed to assistive technology (Highlight API: ${highlightApi})`, () => {
			if (highlightApi) stubHighlightApi();

			const strategy = new Strategy();
			strategy.initialize();
			const a = choiceRange("a");
			strategy.apply("a", a.range);

			// The eliminated state is announced, not hidden: the container hosts
			// the toggle, and an aria-hidden container would hide the undo
			// control along with the answer text (WCAG 4.1.2).
			expect(a.choice.getAttribute("aria-hidden")).toBe(null);
			expect(a.choice.getAttribute("aria-disabled")).toBe("true");
			expect(
				a.choice.querySelector(".pie-answer-eliminator-sr-announcement")
					?.textContent,
			).toBe(" (eliminated)");
			expect(
				a.choice
					.querySelector("button")
					?.closest('[aria-hidden="true"]'),
			).toBe(null);

			strategy.remove("a");
			expect(a.choice.getAttribute("aria-disabled")).toBe(null);
			expect(
				a.choice.querySelector(".pie-answer-eliminator-sr-announcement"),
			).toBe(null);
		});
	}
}

test("mask setChrome relabels existing announcements in place", () => {
	// Fallback path: CSS.highlights absent, so every elimination is a
	// tracked fallback container.
	Object.defineProperty(globalThis, "CSS", {
		value: {},
		configurable: true,
	});

	const strategy = new MaskStrategy();
	strategy.initialize();
	const a = choiceRange("a");
	const b = choiceRange("b");
	strategy.apply("a", a.range);
	strategy.apply("b", b.range);

	const stamped: Element[] = [];
	strategy.setChrome({
		eliminatedText: "verwijderd",
		stamp: (element) => stamped.push(element),
	});

	const announcements = document.querySelectorAll(
		".pie-answer-eliminator-sr-announcement",
	);
	expect(announcements).toHaveLength(2);
	expect([...announcements].map((el) => el.textContent)).toEqual([
		" verwijderd",
		" verwijderd",
	]);
	expect(stamped).toHaveLength(2);

	// Removing the elimination removes its announcement.
	strategy.remove("a");
	expect(
		a.choice.querySelector(".pie-answer-eliminator-sr-announcement"),
	).toBe(null);
	expect(
		b.choice.querySelector(".pie-answer-eliminator-sr-announcement"),
	).not.toBe(null);
});
