import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { MaskStrategy } = await import("../strategies/mask-strategy");
const { StrikethroughStrategy } = await import(
	"../strategies/strikethrough-strategy"
);

// Without the CSS Highlight API both strategies mark the choice element instead.
const originalCSS = globalThis.CSS;
Object.defineProperty(globalThis, "CSS", { value: {}, configurable: true });

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	Object.defineProperty(globalThis, "CSS", {
		value: originalCSS,
		configurable: true,
	});
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

function choiceRange(id: string): { choice: HTMLElement; range: Range } {
	const choice = document.createElement("div");
	choice.setAttribute("data-pie-answer-eliminator-choice", "true");
	choice.innerHTML = `<label>Choice ${id}</label>`;
	document.body.append(choice);
	const range = document.createRange();
	range.selectNodeContents(choice.querySelector("label") as HTMLElement);
	return { choice, range };
}

for (const Strategy of [StrikethroughStrategy, MaskStrategy]) {
	test(`${Strategy.name} tracks eliminations on the fallback path`, () => {
		const strategy = new Strategy();
		strategy.initialize();
		const a = choiceRange("a");
		const b = choiceRange("b");

		strategy.apply("a", a.range);
		strategy.apply("b", b.range);
		expect(strategy.isEliminated("a")).toBe(true);
		expect(strategy.getEliminatedIds().sort()).toEqual(["a", "b"]);

		strategy.remove("a");
		expect(strategy.isEliminated("a")).toBe(false);
		expect(a.choice.hasAttribute("data-pie-answer-eliminated")).toBe(false);

		strategy.clearAll();
		expect(strategy.getEliminatedIds()).toEqual([]);
		expect(b.choice.hasAttribute("data-pie-answer-eliminated")).toBe(false);
	});
}
