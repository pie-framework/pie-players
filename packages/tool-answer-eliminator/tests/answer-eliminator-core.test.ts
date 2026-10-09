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

test("the toggle glyph is hidden from assistive technology and read-aloud", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();

	core.initializeForQuestion(root);

	const toggle = root.querySelector<HTMLButtonElement>(
		"button.pie-answer-eliminator-toggle",
	);
	expect(toggle?.getAttribute("aria-label")).toBe(
		"Toggle elimination for Alpha",
	);
	const exposedText = Array.from(toggle?.childNodes ?? []).filter(
		(node) =>
			node.nodeType === Node.TEXT_NODE ||
			(node as Element).getAttribute?.("aria-hidden") !== "true",
	);
	expect(exposedText).toHaveLength(0);
	expect(toggle?.textContent).toBe("⊗");
});

const twoMultipleChoiceElements = () => {
	const item = document.createElement("div");
	item.innerHTML = `<multiple-choice id="mc1">${choiceMarkup("a", "Alpha") + choiceMarkup("b", "Beta")}</multiple-choice><multiple-choice id="mc2">${choiceMarkup("a", "Apple") + choiceMarkup("b", "Banana")}</multiple-choice>`;
	document.body.append(item);
	const toggles = (elementId: string) =>
		Array.from(
			item.querySelectorAll<HTMLButtonElement>(
				`#${elementId} button.pie-answer-eliminator-toggle`,
			),
		);
	const pressed = (elementId: string) =>
		toggles(elementId).map((toggle) => toggle.getAttribute("aria-pressed"));
	return { item, toggles, pressed };
};

const createStore = () => {
	const states = new Map<string, unknown>();
	return {
		states,
		getState: (key: string, toolId: string) => states.get(`${key}|${toolId}`),
		setState: (key: string, toolId: string, state: unknown) => {
			states.set(`${key}|${toolId}`, state);
		},
	};
};

test("elements sharing choice values keep separate eliminations and state", () => {
	const { item, toggles, pressed } = twoMultipleChoiceElements();
	const store = createStore();
	const keys = { mc1: "a:s:i:mc1", mc2: "a:s:i:mc2" };
	core = new AnswerEliminatorCore();
	core.setStoreIntegration(store, keys);
	core.initializeForQuestion(item);

	expect(toggles("mc1")).toHaveLength(2);
	expect(toggles("mc2")).toHaveLength(2);
	toggles("mc2")[0].click();

	expect(pressed("mc1")).toEqual(["false", "false"]);
	expect(pressed("mc2")).toEqual(["true", "false"]);
	expect(store.states.get("a:s:i:mc1|answerEliminator")).toBeUndefined();
	expect(store.states.get("a:s:i:mc2|answerEliminator")).toEqual({
		eliminatedChoices: ["a"],
	});

	// A fresh core restores each element from its own key.
	core.destroy();
	expect(item.querySelectorAll("button.pie-answer-eliminator-toggle")).toHaveLength(0);
	core = new AnswerEliminatorCore();
	core.setStoreIntegration(store, keys);
	core.initializeForQuestion(item);
	expect(pressed("mc1")).toEqual(["false", "false"]);
	expect(pressed("mc2")).toEqual(["true", "false"]);
	expect(core.getEliminatedCount()).toBe(1);
});

test("re-initializing leaves one button per choice and keeps unkeyed eliminations", () => {
	const { item, toggles, pressed } = twoMultipleChoiceElements();
	core = new AnswerEliminatorCore();
	core.initializeForQuestion(item);
	toggles("mc1")[1].click();

	core.initializeForQuestion(item);

	expect(item.querySelectorAll("button.pie-answer-eliminator-toggle")).toHaveLength(4);
	expect(pressed("mc1")).toEqual(["false", "true"]);
	expect(pressed("mc2")).toEqual(["false", "false"]);
	expect(core.getEliminatedCount()).toBe(1);

	core.destroy();
	core = null;
	expect(item.querySelectorAll("button.pie-answer-eliminator-toggle")).toHaveLength(0);
	expect(
		Array.from(item.querySelectorAll<HTMLInputElement>("input")).every(
			(input) => !input.disabled,
		),
	).toBe(true);
});
