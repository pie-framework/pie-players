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
class FakeNdsIconButton extends HTMLElement {
	connectedCallback() {
		if (!this.querySelector("button")) {
			this.appendChild(document.createElement("button"));
		}
	}
}

test("the toggles become NDS icon buttons once the tag is registered", () => {
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
		"var(--pie-white, #ffffff)",
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

test("two cores on one page keep their strike highlights apart", () => {
	const originalCSS = globalThis.CSS;
	class Highlight {
		constructor(..._ranges: unknown[]) {}
	}
	const highlights = new Map<string, unknown>();
	Object.defineProperty(globalThis, "Highlight", {
		value: Highlight,
		configurable: true,
	});
	Object.defineProperty(globalThis, "CSS", {
		value: { highlights },
		configurable: true,
	});
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
		expect(highlights.size).toBe(2);

		first.querySelector<HTMLButtonElement>("button.pie-answer-eliminator-toggle")?.click();
		expect(highlights.size).toBe(1);
		expect(second.getEliminatedCount()).toBe(1);
	} finally {
		second.destroy();
		Object.defineProperty(globalThis, "CSS", {
			value: originalCSS,
			configurable: true,
		});
		delete (globalThis as { Highlight?: unknown }).Highlight;
		document.head.replaceChildren();
	}
});
