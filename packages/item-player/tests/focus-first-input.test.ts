import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import {
	attachItemPlayerFocus,
	createItemPlayerFocus,
	deepActiveElement,
	ELEMENT_FOCUS_METHOD,
	focusItemFirstInput,
	type ItemFocusReadiness,
	itemFocusCandidates,
	withItemPlayerFocus,
} from "../src/focus-first-input.js";
import type { PieItemPlayerElement } from "../src/types.js";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

afterEach(() => {
	(document.activeElement as HTMLElement | null)?.blur?.();
	document.body.replaceChildren();
});

/** happy-dom reports no layout, so the visibility half of the tabbable filter is stubbed. */
function visible<T extends HTMLElement>(el: T): T {
	Object.defineProperty(el, "getClientRects", {
		configurable: true,
		value: () => [{ width: 10, height: 10 }],
	});
	return el;
}

function input(label: string): HTMLInputElement {
	const el = visible(document.createElement("input"));
	el.setAttribute("aria-label", label);
	return el;
}

/** An element the item markup places, holding `children`. */
function element(tag: string, ...children: Node[]): HTMLElement {
	const el = document.createElement(tag);
	el.append(...children);
	return el;
}

function withHook(
	el: HTMLElement,
	hook: (options?: FocusOptions) => boolean | Promise<boolean>,
): HTMLElement {
	(el as unknown as Record<string, unknown>)[ELEMENT_FOCUS_METHOD] = hook;
	return el;
}

function container(...children: Node[]): HTMLElement {
	const root = document.createElement("div");
	root.append(...children);
	document.body.append(root);
	return root;
}

describe("itemFocusCandidates", () => {
	test("lists the item's custom elements in document order, not their descendants", () => {
		const nested = element("inner-widget", input("inner"));
		const first = element("first-element", nested);
		const second = element("second-element");
		const root = container(
			element("p", document.createTextNode("Stem")),
			element("div", element("table", element("tr", element("td", first)))),
			second,
		);
		expect(itemFocusCandidates(root)).toEqual([first, second]);
	});
});

describe("focusItemFirstInput", () => {
	test("focuses an element's first tabbable descendant when it has no hook", async () => {
		const answer = input("answer");
		const root = container(element("plain-element", input("first"), answer));
		expect(await focusItemFirstInput(root)).toBe(true);
		expect((document.activeElement as HTMLElement).getAttribute("aria-label")).toBe(
			"first",
		);
	});

	test("skips focusable markup outside the elements", async () => {
		const link = visible(document.createElement("a"));
		link.href = "#glossary";
		const target = input("response");
		const root = container(
			element("p", link),
			element("plain-element", target),
		);
		expect(await focusItemFirstInput(root)).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("delegates to the element's hook and passes the options through", async () => {
		const target = input("hooked");
		const fallback = input("not this one");
		const hook = mock((options?: FocusOptions) => {
			expect(options).toEqual({ preventScroll: true });
			target.focus();
			return true;
		});
		const root = container(withHook(element("hooked-element", fallback, target), hook));
		expect(await focusItemFirstInput(root, { preventScroll: true })).toBe(true);
		expect(hook).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(target);
	});

	test("waits for a hook that resolves later", async () => {
		const target = input("mounted later");
		const hooked = withHook(element("async-element"), async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			hooked.append(target);
			target.focus();
			return true;
		});
		const root = container(hooked);
		expect(await focusItemFirstInput(root)).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("moves on when an element's hook reports no input", async () => {
		const next = input("next");
		const root = container(
			withHook(element("display-only", input("hook says none")), () => false),
			element("plain-element", next),
		);
		expect(await focusItemFirstInput(root)).toBe(true);
		expect(document.activeElement).toBe(next);
	});

	test("stops, leaving focus alone, when focus moved while a hook waited", async () => {
		// The contract's hook resolves false for this too, so false alone cannot
		// tell the player to move on.
		const outside = input("notes");
		document.body.append(outside);
		const next = input("next");
		const root = container(
			withHook(element("mounting-element"), async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
				return false;
			}),
			element("plain-element", next),
		);
		const result = focusItemFirstInput(root);
		outside.focus();
		expect(await result).toBe(false);
		expect(document.activeElement).toBe(outside);
	});

	test("falls back to the first tabbable descendant when the hook throws", async () => {
		const target = input("fallback");
		const warn = mock(() => {});
		const root = container(
			withHook(element("broken-element", target), () => {
				throw new Error("not mounted");
			}),
		);
		expect(await focusItemFirstInput(root, undefined, { warn })).toBe(true);
		expect(document.activeElement).toBe(target);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	test("reaches a tabbable inside an element's open shadow root", async () => {
		const host = element("shadow-element");
		const shadowInput = input("in shadow");
		host.attachShadow({ mode: "open" }).append(shadowInput);
		const root = container(host);
		expect(await focusItemFirstInput(root)).toBe(true);
		expect(deepActiveElement()).toBe(shadowInput);
	});

	test("leaves focus where it is when the item has no input", async () => {
		const outside = input("outside");
		document.body.append(outside);
		outside.focus();
		const root = container(
			element("display-element", element("p", document.createTextNode("Read only"))),
		);
		expect(await focusItemFirstInput(root)).toBe(false);
		expect(document.activeElement).toBe(outside);
	});
});

describe("createItemPlayerFocus", () => {
	function setup(initial: ItemFocusReadiness) {
		let readiness = initial;
		const target = input("response");
		const root = container(element("plain-element", target));
		const focus = createItemPlayerFocus({
			readiness: () => readiness,
			itemContainer: () => root,
		});
		return {
			focus,
			target,
			setReadiness(next: ItemFocusReadiness) {
				readiness = next;
			},
		};
	}

	test("focuses at once when the item has loaded", async () => {
		const { focus, target } = setup("ready");
		expect(await focus.focus()).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("resolves false for an item that failed to load", async () => {
		const { focus, target } = setup("unavailable");
		expect(await focus.focus()).toBe(false);
		expect(document.activeElement).not.toBe(target);
	});

	test("waits for the load, then focuses", async () => {
		const { focus, target, setReadiness } = setup("pending");
		const result = focus.focus();
		await Promise.resolve();
		expect(document.activeElement).not.toBe(target);
		setReadiness("ready");
		focus.loaded();
		expect(await result).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("does not take focus the learner moved while the item loaded", async () => {
		const { focus, target, setReadiness } = setup("pending");
		const result = focus.focus();
		const elsewhere = input("elsewhere");
		document.body.append(elsewhere);
		elsewhere.focus();
		setReadiness("ready");
		focus.loaded();
		expect(await result).toBe(false);
		expect(document.activeElement).toBe(elsewhere);
		expect(document.activeElement).not.toBe(target);
	});

	test("focus that fell to the page when its holder was removed has not moved", async () => {
		// A grid that removes the finished item while the next one loads.
		const { focus, target, setReadiness } = setup("pending");
		const finished = input("finished item");
		document.body.append(finished);
		finished.focus();
		const result = focus.focus();
		finished.remove();
		(document.activeElement as HTMLElement | null)?.blur?.();
		setReadiness("ready");
		focus.loaded();
		expect(await result).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("focus the learner put on the page itself has moved", async () => {
		const { focus, target, setReadiness } = setup("pending");
		const field = input("still here");
		document.body.append(field);
		field.focus();
		const result = focus.focus();
		field.blur();
		setReadiness("ready");
		focus.loaded();
		expect(await result).toBe(false);
		expect(document.activeElement).not.toBe(target);
	});

	test("moves focus within the caller's task when nothing is pending", async () => {
		// Firefox shows the focus ring for focus a keyboard handler moves only
		// while that handler runs.
		const target = input("response");
		const root = container(element("plain-element", target));
		const focus = createItemPlayerFocus({
			readiness: () => "ready",
			itemContainer: () => root,
			settle: () => null,
		});
		const result = focus.focus();
		expect(document.activeElement).toBe(target);
		expect(await result).toBe(true);
	});

	test("reads readiness only once the player has acted on the caller's changes", async () => {
		// The host set `config` in the same task: the old item reads ready until
		// the player starts the new load.
		let readiness: ItemFocusReadiness = "ready";
		const target = input("new item");
		const root = container(element("plain-element", target));
		const focus = createItemPlayerFocus({
			readiness: () => readiness,
			itemContainer: () => root,
			settle: async () => {
				await Promise.resolve();
				readiness = "pending";
			},
		});
		const result = focus.focus();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(document.activeElement).not.toBe(target);
		readiness = "ready";
		focus.loaded();
		expect(await result).toBe(true);
		expect(document.activeElement).toBe(target);
	});

	test("a newer call resolves the waiting one false", async () => {
		const { focus, setReadiness } = setup("pending");
		const older = focus.focus();
		const newer = focus.focus();
		expect(await older).toBe(false);
		setReadiness("ready");
		focus.loaded();
		expect(await newer).toBe(true);
	});

	test("a failed load or teardown resolves the waiting call false", async () => {
		const failing = setup("pending");
		const waitingOnFailure = failing.focus.focus();
		failing.setReadiness("unavailable");
		failing.focus.failed();
		expect(await waitingOnFailure).toBe(false);

		const disposed = setup("pending");
		const waitingOnTeardown = disposed.focus.focus();
		disposed.focus.dispose();
		expect(await waitingOnTeardown).toBe(false);
	});
});

describe("withItemPlayerFocus", () => {
	let defined = 0;
	function definePlayer(): CustomElementConstructor {
		const tag = `focus-test-player-${++defined}`;
		const Player = withItemPlayerFocus(class extends HTMLElement {});
		customElements.define(tag, Player);
		return Player;
	}

	function readyFocus(result: boolean) {
		return {
			focus: mock(async (_options?: FocusOptions) => result),
			loaded() {},
			failed() {},
			dispose() {},
		};
	}

	test("routes focus() to the player's controller", async () => {
		const Player = definePlayer();
		const player = new Player() as PieItemPlayerElement;
		document.body.append(player);
		const controller = readyFocus(true);
		attachItemPlayerFocus(player, controller);
		expect(await player.focus({ preventScroll: true })).toBe(true);
		expect(controller.focus.mock.calls[0]?.[0]).toEqual({ preventScroll: true });
	});

	test("waits for a mount that follows insertion by a microtask", async () => {
		const Player = definePlayer();
		const player = new Player() as PieItemPlayerElement;
		document.body.append(player);
		const controller = readyFocus(true);
		const result = player.focus();
		await Promise.resolve();
		attachItemPlayerFocus(player, controller);
		expect(await result).toBe(true);
	});

	test("keeps focus the learner moved before the player mounted", async () => {
		const Player = definePlayer();
		const player = new Player() as PieItemPlayerElement;
		document.body.append(player);
		const target = input("response");
		const root = container(element("plain-element", target));
		let readiness: ItemFocusReadiness = "pending";
		const controller = createItemPlayerFocus({
			readiness: () => readiness,
			itemContainer: () => root,
		});
		const result = player.focus();
		const elsewhere = input("elsewhere");
		document.body.append(elsewhere);
		elsewhere.focus();
		await Promise.resolve();
		attachItemPlayerFocus(player, controller);
		await Promise.resolve();
		readiness = "ready";
		controller.loaded();
		expect(await result).toBe(false);
		expect(document.activeElement).toBe(elsewhere);
	});

	test("resolves false, without throwing, before mount and after teardown", async () => {
		const Player = definePlayer();
		const player = new Player() as PieItemPlayerElement;
		expect(await player.focus()).toBe(false);

		document.body.append(player);
		const detach = attachItemPlayerFocus(player, readyFocus(true));
		detach();
		player.remove();
		expect(await player.focus()).toBe(false);
	});
});
