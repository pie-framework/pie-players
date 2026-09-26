import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { AnswerEliminatorCore } = await import("../answer-eliminator-core");

const choiceMarkup = (value: string, label: string) =>
	`<div class="corespring-radio-button"><input type="radio" value="${value}"><label>${label}</label></div>`;

let core: InstanceType<typeof AnswerEliminatorCore> | null = null;

afterEach(() => {
	core?.destroy();
	core = null;
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

test("elimination toggles expose an unpressed state before the first click", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha") + choiceMarkup("b", "Beta");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();

	core.initializeForQuestion(root);

	const toggles = Array.from(
		root.querySelectorAll<HTMLButtonElement>(
			"button.pie-answer-eliminator-toggle",
		),
	);
	expect(toggles).toHaveLength(2);
	expect(toggles.map((toggle) => toggle.getAttribute("aria-pressed"))).toEqual([
		"false",
		"false",
	]);

	toggles[0].click();
	expect(toggles.map((toggle) => toggle.getAttribute("aria-pressed"))).toEqual([
		"true",
		"false",
	]);
});
