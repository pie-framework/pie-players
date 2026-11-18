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
		"Eliminate Alpha",
	);
	const exposedText = Array.from(toggle?.childNodes ?? []).filter(
		(node) =>
			node.nodeType === Node.TEXT_NODE ||
			(node as Element).getAttribute?.("aria-hidden") !== "true",
	);
	expect(exposedText).toHaveLength(0);
	expect(toggle?.textContent).toBe("");
	expect(
		toggle
			?.querySelector("svg.pie-answer-eliminator-toggle-icon")
			?.getAttribute("aria-hidden"),
	).toBe("true");
});

test("the toggle sits in flow as the choice container's last child", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);

	const container = root.querySelector<HTMLElement>(".corespring-radio-button");
	const toggle = container?.lastElementChild as HTMLElement;
	expect(toggle.classList.contains("pie-answer-eliminator-toggle")).toBe(true);
	expect(toggle.classList.contains("pie-answer-eliminator-toggle--plain")).toBe(
		true,
	);
	expect(toggle.getAttribute("style")).toBe(null);
	expect(container?.getAttribute("style")).toBe(null);
});

test("an eliminated choice is announced on its content and never disabled", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const container = root.querySelector<HTMLElement>(".corespring-radio-button");
	const label = root.querySelector("label");
	const toggle = root.querySelector<HTMLButtonElement>(
		"button.pie-answer-eliminator-toggle",
	);

	toggle?.click();
	expect(container?.getAttribute("data-pie-answer-eliminated")).toBe("true");
	// The container holds the toggle that restores the choice.
	expect(container?.hasAttribute("aria-disabled")).toBe(false);
	expect(container?.closest("[aria-hidden]")).toBe(null);
	expect(label?.getAttribute("data-pie-answer-eliminator-label")).toBe("true");
	expect(
		label?.querySelector(":scope > .pie-answer-eliminator-sr-announcement")
			?.textContent,
	).toBe(" (eliminated)");

	toggle?.click();
	expect(container?.hasAttribute("data-pie-answer-eliminated")).toBe(false);
	expect(root.querySelector(".pie-answer-eliminator-sr-announcement")).toBe(
		null,
	);
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

const singleToggle = () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const toggle = root.querySelector<HTMLButtonElement>(
		"button.pie-answer-eliminator-toggle",
	);
	if (!toggle) throw new Error("no toggle");
	return { root, toggle };
};

const stubI18n = (
	locale: string,
	dir: "ltr" | "rtl",
	strings: Record<string, string>,
) => ({
	getLocale: () => locale,
	getDirection: () => dir,
	t: (key: string, values?: Record<string, unknown>) =>
		(strings[key] ?? key).replace(/\{(\w+)\}/g, (_, name) =>
			String(values?.[name] ?? ""),
		),
});

const arabic = stubI18n("ar", "rtl", {
	"tools.answerEliminator.toggleA11y": "شطب {choice}",
	"tools.answerEliminator.eliminatedA11y": "(مشطوب)",
	"tools.answerEliminator.unlabeledChoice": "خيار بلا تسمية",
});

test("the toggle and the eliminated announcement speak the interface locale", () => {
	const { root, toggle } = singleToggle();
	expect(toggle.getAttribute("lang")).toBe("en-US");
	expect(toggle.getAttribute("dir")).toBe("ltr");

	toggle.click();
	const announcement = root.querySelector(
		".pie-answer-eliminator-sr-announcement",
	);
	expect(announcement?.textContent).toBe(" (eliminated)");
	expect(announcement?.getAttribute("lang")).toBe("en-US");

	// A locale change relabels in place and keeps the elimination.
	core?.setInterfaceI18n(arabic);
	expect(toggle.getAttribute("aria-label")).toBe("شطب Alpha");
	expect(toggle.getAttribute("lang")).toBe("ar");
	expect(toggle.getAttribute("dir")).toBe("rtl");
	expect(toggle.getAttribute("aria-pressed")).toBe("true");
	expect(announcement?.textContent).toBe(" (مشطوب)");
	expect(announcement?.getAttribute("dir")).toBe("rtl");
});

test("a choice with no text is named from the catalog", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.setInterfaceI18n(arabic);
	core.disableStateRestoration();
	core.initializeForQuestion(root);

	expect(
		root
			.querySelector("button.pie-answer-eliminator-toggle")
			?.getAttribute("aria-label"),
	).toBe("شطب خيار بلا تسمية");
});

/** Stands in for the vendored Lit button: it renders an inner <button>. */
/** Renders its inner <button> after its first update, as the Lit button does. */
class FakeNdsIconButton extends HTMLElement {
	updateComplete: Promise<void> = Promise.resolve();
	connectedCallback() {
		this.updateComplete = Promise.resolve().then(() => {
			if (!this.querySelector("button")) {
				this.appendChild(document.createElement("button"));
			}
		});
	}
}

test("the toggles become NDS icon buttons once the tag is registered", async () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha") + choiceMarkup("b", "Beta");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	root.querySelector<HTMLButtonElement>("button.pie-answer-eliminator-toggle")?.click();

	if (!customElements.get("pie-nds-icon-button")) {
		customElements.define("pie-nds-icon-button", FakeNdsIconButton);
	}
	core.setNdsIcons(true);
	await nextFrame();

	const nds = Array.from(root.querySelectorAll<HTMLElement>("pie-nds-icon-button"));
	expect(nds).toHaveLength(2);
	expect(root.querySelectorAll("button.pie-answer-eliminator-toggle")).toHaveLength(0);
	expect(nds.map((host) => host.parentElement?.lastElementChild === host)).toEqual([
		true,
		true,
	]);
	expect(nds[0].classList.contains("pie-answer-eliminator-toggle--nds")).toBe(true);
	expect(nds[0].getAttribute("button-aria-label")).toBe(
		"Eliminate Alpha",
	);
	// The button reads the NDS palette, bridged to the theme.
	expect(nds[0].style.getPropertyValue("--color-primary-white")).toBe(
		"var(--pie-button-background-color, var(--pie-button-bg, var(--pie-white, #ffffff)))",
	);
	// The pressed state survives the swap, reflected onto the inner button.
	expect(
		nds.map((host) => host.querySelector("button")?.getAttribute("aria-pressed")),
	).toEqual(["true", "false"]);

	nds[1].querySelector("button")?.click();
	expect(nds[1].querySelector("button")?.getAttribute("aria-pressed")).toBe("true");
	expect(core.getEliminatedCount()).toBe(2);

	core.setNdsIcons(false);
	expect(root.querySelectorAll("pie-nds-icon-button")).toHaveLength(0);
	expect(
		Array.from(
			root.querySelectorAll("button.pie-answer-eliminator-toggle"),
			(toggle) => toggle.getAttribute("aria-pressed"),
		),
	).toEqual(["true", "true"]);
});

/** The markup legacy pie-elements multiple choice renders for one choice. */
const legacyMuiChoice = (value: string, key: string, prompt: string) =>
	`<div class="corespring-radio-button choice-input"><div class="row"><div class="checkbox-holder"><label class="MuiFormControlLabel-root"><span class="sr-only">${key}</span><span class="MuiRadio-root MuiButtonBase-root"><input type="radio" value="${value}"></span><span class="MuiFormControlLabel-label"><span><span aria-hidden="true">${key}. </span><span class="prompt-label">${prompt}</span></span></span></label></div></div><div class="rationale">Rationale</div></div>`;

test("a legacy choice takes its toggle at the end of its row, named from the prompt", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = legacyMuiChoice("a", "A", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);

	const choice = root.querySelector<HTMLElement>(".corespring-radio-button");
	const row = root.querySelector<HTMLElement>(".row");
	const toggle = row?.lastElementChild as HTMLButtonElement;
	expect(toggle.classList.contains("pie-answer-eliminator-toggle")).toBe(true);
	expect(choice?.lastElementChild?.className).toBe("rationale");
	expect(toggle.getAttribute("aria-label")).toBe("Eliminate Alpha");
	// The struck and dimmed content leaves out the radio.
	const content = root.querySelector("[data-pie-answer-eliminator-label]");
	expect(content?.className).toBe("MuiFormControlLabel-label");

	toggle.click();
	expect(row?.getAttribute("data-pie-answer-eliminated")).toBe("true");
	expect(root.querySelector("input")?.disabled).toBe(true);
});

const nextFrame = () =>
	new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
// The observer reports after the frame a test queues, so the core refreshes in the next.
const refreshed = async () => {
	await nextFrame();
	await nextFrame();
};

/** Renders the inputs as legacy multiple choice does on a mode change. */
const renderMode = (root: HTMLElement, mode: "gather" | "evaluate") => {
	for (const input of root.querySelectorAll("input")) {
		input.disabled = mode !== "gather";
	}
};

const legacyPair = () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = legacyMuiChoice("a", "A", "Alpha") + legacyMuiChoice("b", "B", "Beta");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const toggles = () =>
		Array.from(
			root.querySelectorAll<HTMLButtonElement>("button.pie-answer-eliminator-toggle"),
		);
	const inputs = () => Array.from(root.querySelectorAll("input"), (input) => input.disabled);
	return { root, toggles, inputs };
};

test("a legacy choice struck before evaluate mode stays struck and unselectable there", async () => {
	const { root, toggles, inputs } = legacyPair();
	toggles()[0].click();

	renderMode(root, "evaluate");
	await refreshed();

	expect(toggles()[0].disabled).toBe(true);
	expect(toggles()[1].style.display).toBe("none");
	// A browser sends no click to a disabled button; the core refuses one anyway.
	toggles()[0].disabled = false;
	toggles()[0].click();
	expect(toggles()[0].getAttribute("aria-pressed")).toBe("true");
	expect(inputs()).toEqual([true, true]);

	// Restored programmatically, the input keeps the element's read-only state.
	core?.resetAll();
	expect(inputs()).toEqual([true, true]);
});

test("a legacy re-render that lifts a struck choice's block is blocked again", async () => {
	const { root, toggles, inputs } = legacyPair();
	toggles()[0].click();

	renderMode(root, "evaluate");
	await refreshed();
	renderMode(root, "gather");
	await refreshed();

	expect(inputs()).toEqual([true, false]);
	expect(toggles()[0].disabled).toBe(false);
	toggles()[0].click();
	expect(inputs()).toEqual([false, false]);
	expect(toggles()[1].style.display).toBe("");
});

test("two cores on one page keep their eliminations apart", () => {
	const second = new AnswerEliminatorCore();
	try {
		const first = document.createElement("multiple-choice");
		const other = document.createElement("multiple-choice");
		first.innerHTML = choiceMarkup("a", "Alpha");
		other.innerHTML = choiceMarkup("a", "Apple");
		document.body.append(first, other);
		core = new AnswerEliminatorCore();
		core.disableStateRestoration();
		core.initializeForQuestion(first);
		second.disableStateRestoration();
		second.initializeForQuestion(other);

		for (const root of [first, other]) {
			root.querySelector<HTMLButtonElement>("button.pie-answer-eliminator-toggle")?.click();
		}
		expect([core.getEliminatedCount(), second.getEliminatedCount()]).toEqual([1, 1]);

		first.querySelector<HTMLButtonElement>("button.pie-answer-eliminator-toggle")?.click();
		expect([core.getEliminatedCount(), second.getEliminatedCount()]).toEqual([0, 1]);
		expect(other.querySelector("[data-pie-answer-eliminated]")).not.toBe(null);
	} finally {
		second.destroy();
	}
});

test("every struck choice keeps a frozen toggle in evaluate mode", async () => {
	const { root, toggles, inputs } = legacyPair();
	for (const toggle of toggles()) toggle.click();

	// With every input blocked, the inputs cannot show the mode; the model does.
	(root as HTMLElement & { _model?: unknown })._model = { disabled: true };
	renderMode(root, "evaluate");
	await refreshed();

	expect(toggles().map((toggle) => [toggle.style.display, toggle.disabled])).toEqual([
		["", true],
		["", true],
	]);
	for (const toggle of toggles()) {
		toggle.disabled = false;
		toggle.click();
	}
	expect(toggles().map((toggle) => toggle.getAttribute("aria-pressed"))).toEqual([
		"true",
		"true",
	]);
	expect(inputs()).toEqual([true, true]);
});

test("a legacy element's model holds its choices read-only", async () => {
	const { root, toggles } = legacyPair();
	toggles()[0].click();

	(root as HTMLElement & { _model?: unknown })._model = { disabled: true };
	root.dispatchEvent(new Event("change", { bubbles: true }));
	await nextFrame();

	expect(toggles()[0].disabled).toBe(true);
	expect(toggles()[1].style.display).toBe("none");
});

test("a legacy element's session says which choice is selected", () => {
	const root = document.createElement("multiple-choice") as HTMLElement & {
		session?: unknown;
	};
	root.innerHTML = choiceMarkup("a", "Alpha") + choiceMarkup("b", "Beta");
	root.session = { value: ["b"] };
	// A shown correct answer checks its input and leaves the session as it was.
	(root.querySelector('input[value="a"]') as HTMLInputElement).checked = true;
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);

	const toggles = Array.from(
		root.querySelectorAll<HTMLButtonElement>("button.pie-answer-eliminator-toggle"),
	);
	expect(toggles.map((toggle) => toggle.style.visibility)).toEqual(["", "hidden"]);
	toggles[0].click();
	expect(toggles[0].getAttribute("aria-pressed")).toBe("true");
});

test("a strategy change repaints the struck choices in place, with the tool off too", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha") + choiceMarkup("b", "Beta");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const toggles = () =>
		Array.from(
			root.querySelectorAll<HTMLButtonElement>("button.pie-answer-eliminator-toggle"),
		);
	const [struck] = toggles();
	struck.click();
	struck.focus();
	core.cleanup();

	core.setStrategy("mask");

	const labels = Array.from(root.querySelectorAll("label"));
	const masked = () =>
		labels.map((label) => label.classList.contains("pie-answer-eliminator-masked"));
	expect(masked()).toEqual([true, false]);
	expect(toggles()[0]).toBe(struck);
	expect(document.activeElement).toBe(struck);
	expect(struck.getAttribute("aria-pressed")).toBe("true");
	expect(root.querySelector("input")?.disabled).toBe(true);
	expect(toggles()[1].style.display).toBe("none");

	core.setStrategy("strikethrough");
	expect(masked()).toEqual([false, false]);
	expect(core.getEliminatedCount()).toBe(1);
});

test("choices an element renders after the tool turns on get toggles", async () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const toggles = () =>
		Array.from(
			root.querySelectorAll<HTMLButtonElement>("button.pie-answer-eliminator-toggle"),
		);
	const [first] = toggles();
	first.click();

	root.insertAdjacentHTML("beforeend", choiceMarkup("b", "Beta"));
	await refreshed();

	expect(toggles().map((toggle) => toggle.getAttribute("aria-label"))).toEqual([
		"Eliminate Alpha",
		"Eliminate Beta",
	]);
	// The choice already tracked keeps its toggle and its elimination.
	expect(toggles()[0]).toBe(first);
	expect(first.getAttribute("aria-pressed")).toBe("true");
});

test("restoring a choice with the tool off moves focus to its control", () => {
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.initializeForQuestion(root);
	const toggle = root.querySelector<HTMLButtonElement>(
		"button.pie-answer-eliminator-toggle",
	) as HTMLButtonElement;
	toggle.click();
	core.cleanup();

	toggle.focus();
	toggle.click();

	expect(toggle.style.display).toBe("none");
	expect(document.activeElement).toBe(root.querySelector("input"));
});

test("an NDS toggle created for a re-rendered choice takes focus once it renders", async () => {
	if (!customElements.get("pie-nds-icon-button")) {
		customElements.define("pie-nds-icon-button", FakeNdsIconButton);
	}
	const root = document.createElement("multiple-choice");
	root.innerHTML = choiceMarkup("a", "Alpha");
	document.body.append(root);
	core = new AnswerEliminatorCore();
	core.disableStateRestoration();
	core.setNdsIcons(true);
	core.initializeForQuestion(root);
	await nextFrame();
	(root.querySelector("pie-nds-icon-button button") as HTMLButtonElement).focus();

	// The element replaces the choice's markup; its toggle goes with it.
	root.innerHTML = choiceMarkup("a", "Alpha");
	await refreshed();

	const replacement = root.querySelector("pie-nds-icon-button button");
	expect(replacement).not.toBe(null);
	expect(document.activeElement).toBe(replacement);
});
