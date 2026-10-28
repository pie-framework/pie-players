import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, expect, spyOn, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

const { AnswerEliminatorCore } = await import("../answer-eliminator-core");

const legacyChoice = (value: string, label: string) =>
	`<div class="corespring-radio-button"><input type="radio" value="${value}"><label>${label}</label></div>`;

/**
 * An element built outside this repository: it declares answer masking and
 * supplies its choices, with no markup the legacy adapters recognize.
 */
class AcmeChoices extends HTMLElement {
	static pieSupports = ["answer-masking"];
	selected = new Set<string>();
	locked = false;
	calls: Array<[string, boolean]> = [];

	render(ids: string[]): this {
		this.innerHTML = ids
			.map(
				(id) =>
					`<div class="row" data-id="${id}"><span class="text">Choice ${id}</span></div>`,
			)
			.join("");
		return this;
	}

	pieSupportTargets(term: string) {
		if (term !== "answer-masking") return [];
		return Array.from(this.querySelectorAll<HTMLElement>(".row")).map(
			(row) => {
				const id = row.dataset.id as string;
				return {
					id,
					label: `Choice ${id}`,
					container: row,
					content: row.querySelector(".text") as Element,
					isSelected: () => this.selected.has(id),
					isEliminable: () => !this.locked && !this.selected.has(id),
					setEliminated: (eliminated: boolean) => {
						this.calls.push([id, eliminated]);
					},
				};
			},
		);
	}
}
customElements.define("acme-choices", AcmeChoices);

/** Two declaring parts whose choices the outer element supplies, ids prefixed. */
class AcmePair extends HTMLElement {
	static pieSupports = ["answer-masking"];
	pieSupportTargets(term: string) {
		return Array.from(this.querySelectorAll<AcmeChoices>("acme-choices")).flatMap(
			(part) =>
				part
					.pieSupportTargets(term)
					.map((target) => ({ ...target, id: `${part.id}-${target.id}` })),
		);
	}
}
customElements.define("acme-pair", AcmePair);

class AcmeSpeechOnly extends HTMLElement {
	static pieSupports = ["text-to-speech"];
}
customElements.define("acme-speech-only", AcmeSpeechOnly);

class AcmeBroken extends HTMLElement {
	static pieSupports = ["answer-masking"];
	pieSupportTargets(): never {
		throw new Error("not rendered");
	}
}
customElements.define("acme-broken", AcmeBroken);

/**
 * An element that renders its text from an HTML string, replacing every
 * token's markup on each `setEliminated` call, changed or not.
 */
class AcmeText extends HTMLElement {
	static pieSupports = ["answer-masking"];
	ids: string[] = [];
	eliminated = new Set<string>();
	calls: Array<[string, boolean]> = [];
	renders = 0;

	render(ids = this.ids): this {
		this.ids = ids;
		this.renders++;
		// happy-dom applies no user-agent styles, so the inline display is set.
		this.innerHTML = `<p>${ids
			.map(
				(id) =>
					`<span class="token" data-id="${id}" style="display: inline"><span role="button">Token ${id}</span></span>`,
			)
			.join(" ")}</p>`;
		return this;
	}

	pieSupportTargets(term: string) {
		if (term !== "answer-masking") return [];
		return Array.from(this.querySelectorAll<HTMLElement>(".token")).map(
			(token) => {
				const id = token.dataset.id as string;
				return {
					id,
					label: `Token ${id}`,
					container: token,
					content: token.firstElementChild as Element,
					isSelected: () => false,
					isEliminable: () => true,
					setEliminated: (eliminated: boolean) => {
						this.calls.push([id, eliminated]);
						if (eliminated) this.eliminated.add(id);
						else this.eliminated.delete(id);
						this.render();
					},
				};
			},
		);
	}
}
customElements.define("acme-text", AcmeText);

let core: InstanceType<typeof AnswerEliminatorCore> | null = null;

afterEach(() => {
	core?.destroy();
	core = null;
	document.body.replaceChildren();
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

const acmeChoices = (ids: string[], id?: string) => {
	const element = (document.createElement("acme-choices") as AcmeChoices).render(
		ids,
	);
	if (id) element.id = id;
	return element;
};

const acmeText = (ids: string[], id?: string) => {
	const element = (document.createElement("acme-text") as AcmeText).render(ids);
	if (id) element.id = id;
	return element;
};

// Mutation observer callbacks have run.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const toggle = (root: ParentNode, id: string) =>
	toggles(root).find((button) => button.dataset.choiceId === id) as HTMLButtonElement;

const toggles = (root: ParentNode) =>
	Array.from(
		root.querySelectorAll<HTMLButtonElement>(
			"button.pie-answer-eliminator-toggle",
		),
	);

const start = (root: HTMLElement, keys: Record<string, string> = {}) => {
	const states = new Map<string, unknown>();
	// A side placement, so an inline choice's own fallback to `inline` shows.
	core = new AnswerEliminatorCore("strikethrough", "end");
	core.setStoreIntegration(
		{
			getState: (key, toolId) => states.get(`${key}|${toolId}`),
			setState: (key, toolId, state) => {
				states.set(`${key}|${toolId}`, state);
			},
		},
		keys,
	);
	core.initializeForQuestion(root);
	return states;
};

test("a declaring element gets a toggle in each container it supplies", () => {
	const element = acmeChoices(["x", "y"]);
	document.body.append(element);

	start(element);

	const rows = Array.from(element.querySelectorAll<HTMLElement>(".row"));
	expect(rows.map((row) => toggles(row).length)).toEqual([1, 1]);
	expect(toggles(element).map((toggle) => toggle.dataset.choiceId)).toEqual([
		"x",
		"y",
	]);
	expect(toggles(element)[0].getAttribute("aria-label")).toBe(
		"Toggle elimination for Choice x",
	);
});

test("toggling asks the element to block and restore the choice", () => {
	const element = acmeChoices(["x", "y"]);
	document.body.append(element);
	start(element);

	toggles(element)[1].click();
	expect(element.calls).toEqual([["y", true]]);
	expect(toggles(element)[1].getAttribute("aria-pressed")).toBe("true");

	toggles(element)[1].click();
	expect(element.calls).toEqual([
		["y", true],
		["y", false],
	]);
	expect(core?.getEliminatedCount()).toBe(0);
});

test("a choice the element reports as not eliminable stays in play", () => {
	const element = acmeChoices(["x", "y"]);
	element.selected.add("x");
	document.body.append(element);
	const warn = spyOn(console, "warn").mockImplementation(() => {});

	start(element);
	expect(toggles(element)[0].style.display).toBe("none");

	element.locked = true;
	toggles(element)[1].click();
	warn.mockRestore();

	expect(element.calls).toEqual([]);
	expect(core?.getEliminatedCount()).toBe(0);
});

test("eliminations persist under the declaring element's key", () => {
	const element = acmeChoices(["x", "y"], "q1");
	const item = document.createElement("div");
	item.append(element);
	document.body.append(item);
	const keys = { q1: "a:s:i:q1" };
	const states = start(item, keys);

	toggles(element)[0].click();
	expect(states.get("a:s:i:q1|answerEliminator")).toEqual({
		eliminatedChoices: ["x"],
	});

	core?.destroy();
	element.calls = [];
	core = new AnswerEliminatorCore();
	core.setStoreIntegration(
		{
			getState: (key, toolId) => states.get(`${key}|${toolId}`),
			setState: () => {},
		},
		keys,
	);
	core.initializeForQuestion(item);
	expect(element.calls).toEqual([["x", true]]);
	expect(toggles(element).map((toggle) => toggle.getAttribute("aria-pressed"))).toEqual([
		"true",
		"false",
	]);
});

test("malformed or repeated choices are skipped and the rest kept", () => {
	const element = acmeChoices(["x", "y", "z"]);
	const supplied = element.pieSupportTargets("answer-masking");
	const outside = document.createElement("span");
	element.pieSupportTargets = () => [
		supplied[0],
		{ ...supplied[1], content: outside },
		{ ...supplied[2], setEliminated: undefined },
		{ ...supplied[0], label: "again" },
		null,
	];
	document.body.append(element);
	const warn = spyOn(console, "warn").mockImplementation(() => {});

	start(element);
	const warnings = warn.mock.calls.filter(([message]) =>
		String(message).includes("supplied a choice"),
	).length;
	warn.mockRestore();

	expect(toggles(element).map((toggle) => toggle.dataset.choiceId)).toEqual([
		"x",
	]);
	expect(warnings).toBe(4);
});

test("the outermost declaring element supplies its parts' choices once", () => {
	const pair = document.createElement("acme-pair");
	pair.append(acmeChoices(["x", "y"], "a"), acmeChoices(["x"], "b"));
	document.body.append(pair);

	start(pair);

	expect(toggles(pair).map((toggle) => toggle.dataset.choiceId)).toEqual([
		"a-x",
		"a-y",
		"b-x",
	]);
});

test("legacy markup inside a declaring element is not adapted again", () => {
	const element = document.createElement("acme-choices") as AcmeChoices;
	element.innerHTML = legacyChoice("x", "Legacy x");
	const row = element.firstElementChild as HTMLElement;
	element.pieSupportTargets = () => [
		{
			id: "x",
			label: "Choice x",
			container: row,
			content: row.querySelector("label") as Element,
			isSelected: () => false,
			isEliminable: () => true,
			setEliminated: () => {},
		},
	];
	const item = document.createElement("div");
	item.append(element);
	item.insertAdjacentHTML(
		"beforeend",
		`<multiple-choice>${legacyChoice("a", "Alpha")}</multiple-choice>`,
	);
	document.body.append(item);

	start(item);

	expect(toggles(element)).toHaveLength(1);
	expect(toggles(item).map((toggle) => toggle.dataset.choiceId)).toEqual([
		"x",
		"a",
	]);
});

test("an element declaring other supports gets no toggles, legacy markup included", () => {
	const element = document.createElement("acme-speech-only");
	element.innerHTML = legacyChoice("a", "Alpha");
	document.body.append(element);

	start(element);

	expect(toggles(element)).toHaveLength(0);
});

test("an element whose choices cannot be read leaves the others working", () => {
	const item = document.createElement("div");
	item.append(document.createElement("acme-broken"), acmeChoices(["x"]));
	document.body.append(item);
	const error = spyOn(console, "error").mockImplementation(() => {});

	start(item);
	const errors = error.mock.calls.length;
	error.mockRestore();

	expect(errors).toBe(1);
	expect(toggles(item).map((toggle) => toggle.dataset.choiceId)).toEqual(["x"]);
});

test("eliminations outlive an element replacing its choices' markup", async () => {
	const element = acmeText(["x", "y", "z"]);
	document.body.append(element);
	start(element);

	toggle(element, "y").focus();
	toggle(element, "y").click();
	await settle();

	expect(toggles(element).map((button) => button.isConnected)).toEqual([
		true,
		true,
		true,
	]);
	expect(toggle(element, "y").getAttribute("aria-pressed")).toBe("true");
	expect(document.activeElement).toBe(toggle(element, "y"));
	expect(
		element.querySelector('[data-id="y"]')?.getAttribute("data-pie-answer-eliminated"),
	).toBe("true");
	expect(core?.getEliminatedCount()).toBe(1);
	// Not asked again, so an element that re-renders on every call settles.
	expect(element.calls).toEqual([["y", true]]);
	expect(element.renders).toBe(2);

	toggle(element, "y").click();
	await settle();
	expect(element.calls).toEqual([
		["y", true],
		["y", false],
	]);
	expect(toggle(element, "y").getAttribute("aria-pressed")).toBe("false");
	expect(core?.getEliminatedCount()).toBe(0);
});

test("a choice its element stops supplying is restored there", async () => {
	const element = acmeText(["x", "y"]);
	document.body.append(element);
	start(element);
	toggle(element, "y").click();
	await settle();

	element.render(["x"]);
	await settle();

	expect(element.eliminated.size).toBe(0);
	expect(core?.getEliminatedCount()).toBe(0);
	expect(toggles(element).map((button) => button.dataset.choiceId)).toEqual(["x"]);
});

test("a replacement element instance is asked to block the choice", async () => {
	const item = document.createElement("div");
	item.append(acmeText(["x", "y"], "q1"));
	document.body.append(item);
	start(item, { q1: "a:s:i:q1" });
	toggle(item, "y").click();
	await settle();

	const replacement = acmeText(["x", "y"], "q1");
	item.replaceChildren(replacement);
	await settle();

	expect(replacement.calls).toEqual([["y", true]]);
	expect(toggle(item, "y").getAttribute("aria-pressed")).toBe("true");
});

test("a choice laid out inline takes its toggle in the line", () => {
	const element = acmeText(["x"]);
	document.body.append(element);

	start(element);

	const [button] = toggles(element);
	expect(button.parentElement?.dataset.id).toBe("x");
	expect(button.style.position).toBe("relative");
	expect(button.style.display).toBe("inline-flex");
});

test("element ids limit the toggles to those elements' choices", () => {
	const root = document.createElement("div");
	const listed = acmeChoices(["x", "y"], "q1");
	const unlisted = acmeChoices(["z"], "q2");
	root.append(listed, unlisted);
	document.body.append(root);

	core = new AnswerEliminatorCore("strikethrough", "end");
	core.setElementIds(["q1"]);
	core.initializeForQuestion(root);
	expect(toggles(root).map((button) => button.dataset.choiceId)).toEqual(["x", "y"]);

	core.setElementIds(null);
	core.initializeForQuestion(root);
	expect(toggles(root).map((button) => button.dataset.choiceId)).toEqual(["x", "y", "z"]);

	core.setElementIds([]);
	core.initializeForQuestion(root);
	expect(toggles(root)).toEqual([]);
});

test("element ids reach legacy choices through their element's id", () => {
	const root = document.createElement("div");
	root.innerHTML = `<multiple-choice id="q1">${legacyChoice("a", "Alpha")}</multiple-choice><multiple-choice id="q2">${legacyChoice("b", "Beta")}</multiple-choice>`;
	document.body.append(root);

	core = new AnswerEliminatorCore("strikethrough", "end");
	core.setElementIds(["q2"]);
	core.initializeForQuestion(root);

	expect(toggles(root).map((button) => button.dataset.choiceId)).toEqual(["b"]);
});
