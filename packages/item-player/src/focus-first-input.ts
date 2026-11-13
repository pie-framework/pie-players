/**
 * `focus()` on `<pie-item-player>`: focus the first input of the item it renders.
 *
 * The player has no tab stop of its own, so the native `focus()` did nothing.
 * This one behaves like a `delegatesFocus` host: focus goes to the item's first
 * input, and an item with none leaves focus where it is. Each PIE element in the
 * item is asked in document order through {@link ELEMENT_FOCUS_METHOD}; an
 * element without that hook gets its first tabbable descendant.
 */
import { collectFocusable } from "@pie-players/pie-players-shared";

/**
 * The element hook, `focusFirstInput(options?: FocusOptions): boolean | Promise<boolean>`.
 *
 * Resolves true once the element's first input holds focus and false when the
 * element has no input to focus. Spelled out here rather than imported, as
 * `commitPendingSession` is, so the player carries no dependency on the element
 * repositories. The element contract in pie-elements-ng documents it.
 */
export const ELEMENT_FOCUS_METHOD = "focusFirstInput";

type FocusHook = (options?: FocusOptions) => boolean | Promise<boolean>;

type FocusLogger = { warn: (message: string, ...args: unknown[]) => void };

/** The focused element, followed into open shadow roots. */
export function deepActiveElement(doc: Document = document): Element | null {
	let active: Element | null = doc.activeElement;
	while (active?.shadowRoot?.activeElement) {
		active = active.shadowRoot.activeElement;
	}
	return active;
}

/** Whether `node` is `root` or inside it, crossing shadow boundaries. */
function containsDeep(root: Element, node: Node | null): boolean {
	let current: Node | null = node;
	while (current) {
		if (current === root) return true;
		current = current instanceof ShadowRoot ? current.host : current.parentNode;
	}
	return false;
}

/**
 * The custom elements the item markup places, in document order. A candidate's
 * subtree is the element's own, so the walk does not descend into it.
 */
export function itemFocusCandidates(container: Element): HTMLElement[] {
	const found: HTMLElement[] = [];
	const visit = (node: Element): void => {
		for (const child of Array.from(node.children)) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.localName.includes("-")) found.push(child);
			else visit(child);
		}
	};
	visit(container);
	return found;
}

function focusFirstTabbable(element: HTMLElement, options?: FocusOptions): boolean {
	// An element that renders into its own shadow root keeps its inputs there.
	for (const target of collectFocusable(element.shadowRoot ?? element)) {
		target.focus(options);
		if (containsDeep(element, deepActiveElement(element.ownerDocument))) return true;
	}
	return false;
}

async function focusElementFirstInput(
	element: HTMLElement,
	options: FocusOptions | undefined,
	logger?: FocusLogger,
): Promise<boolean> {
	const hook = (element as unknown as Record<string, unknown>)[ELEMENT_FOCUS_METHOD];
	if (typeof hook !== "function") return focusFirstTabbable(element, options);
	try {
		return (await (hook as FocusHook).call(element, options)) === true;
	} catch (error) {
		logger?.warn(
			`[pie-item-player] <${element.localName}>.${ELEMENT_FOCUS_METHOD}() failed; focusing its first tabbable descendant`,
			error,
		);
		return focusFirstTabbable(element, options);
	}
}

/** Focus the first input among the item's elements, in document order. */
export async function focusItemFirstInput(
	container: Element,
	options?: FocusOptions,
	logger?: FocusLogger,
): Promise<boolean> {
	const doc = container.ownerDocument;
	for (const element of itemFocusCandidates(container)) {
		const before = deepActiveElement(doc);
		if (await focusElementFirstInput(element, options, logger)) return true;
		// A hook resolves false both when its element has no input and when focus
		// moved while it waited, and leaves that focus alone. Only the first lets
		// the next element take focus.
		if (deepActiveElement(doc) !== before) return false;
	}
	return false;
}

/**
 * Whether focus left `held` only because `held` could no longer hold it: it left
 * the page, stopped rendering or was disabled, and the browser moved focus to the
 * document. No learner chose that, so it is no move to respect.
 */
function lostItsFocus(held: Element, now: Element | null, doc: Document): boolean {
	if (now && now !== doc.body && now !== doc.documentElement) return false;
	if (!held.isConnected || held.matches(":disabled")) return true;
	const element = held as HTMLElement;
	return typeof element.checkVisibility === "function" && !element.checkVisibility();
}

/** Whether focus moved since `activeAtCall` held it. */
function focusMovedSince(activeAtCall: Element | null, doc: Document): boolean {
	const now = deepActiveElement(doc);
	if (now === activeAtCall) return false;
	return !(activeAtCall && lostItsFocus(activeAtCall, now, doc));
}

/**
 * Where the player stands for `focus()`: `ready` once the rendered item has
 * loaded, `pending` while it loads, `unavailable` when it failed to.
 */
export type ItemFocusReadiness = "ready" | "pending" | "unavailable";

export type ItemPlayerFocus = {
	/**
	 * `activeAtCall` is what held focus when the host called, which can precede
	 * this call by the wait for the player to mount.
	 */
	focus(options?: FocusOptions, activeAtCall?: Element | null): Promise<boolean>;
	/** The rendered item finished loading. */
	loaded(): void;
	/** The rendered item will not load. */
	failed(): void;
	/** The player is being destroyed. */
	dispose(): void;
};

/**
 * `focus()` for one player.
 *
 * A call made while the item loads waits for it, and then focuses only if focus
 * has not moved since the call: a learner who clicked elsewhere in the meantime
 * keeps that focus. Focus that fell to the document because the element holding
 * it was removed or hidden did not move. One call waits at a time, and a newer
 * one resolves the older false.
 */
export function createItemPlayerFocus(deps: {
	readiness: () => ItemFocusReadiness;
	itemContainer: () => Element | null;
	/**
	 * Resolves once the player has acted on changes made before the call, or
	 * returns null when there are none. A host that sets `config` and calls
	 * `focus()` in one task otherwise finds the old item still ready and focuses
	 * an input the new load is about to remove. With nothing pending, focus moves
	 * within the caller's task, which is what makes Firefox show the focus ring
	 * for focus moved from a keyboard handler.
	 */
	settle?: () => Promise<void> | null;
	logger?: FocusLogger;
}): ItemPlayerFocus {
	let waiting: ((loaded: boolean) => void) | null = null;

	const settle = (loaded: boolean): void => {
		const resolve = waiting;
		waiting = null;
		resolve?.(loaded);
	};

	const waitForLoad = (): Promise<boolean> => {
		settle(false);
		return new Promise((resolve) => {
			waiting = resolve;
		});
	};

	const focusNow = (options?: FocusOptions): Promise<boolean> => {
		const container = deps.itemContainer();
		return container
			? focusItemFirstInput(container, options, deps.logger)
			: Promise.resolve(false);
	};

	return {
		async focus(options, activeAtCall = deepActiveElement()) {
			const settling = deps.settle?.();
			if (settling) await settling;
			const readiness = deps.readiness();
			if (readiness === "unavailable") return false;
			if (readiness === "ready") return focusNow(options);
			if (!(await waitForLoad())) return false;
			if (deps.readiness() !== "ready") return false;
			if (focusMovedSince(activeAtCall, document)) return false;
			return focusNow(options);
		},
		loaded: () => settle(true),
		failed: () => settle(false),
		dispose: () => settle(false),
	};
}

const playerFocus = new WeakMap<HTMLElement, ItemPlayerFocus>();

/** Attach `focus` to the custom element `host`; returns the detach. */
export function attachItemPlayerFocus(
	host: HTMLElement,
	focus: ItemPlayerFocus,
): () => void {
	playerFocus.set(host, focus);
	return () => {
		if (playerFocus.get(host) === focus) playerFocus.delete(host);
	};
}

// Svelte mounts a custom element one microtask after it connects, so a `focus()`
// made right after insertion finds no instance yet.
const MOUNT_WAIT_TURNS = 3;

async function focusItemPlayer(
	host: HTMLElement,
	options?: FocusOptions,
): Promise<boolean> {
	const activeAtCall = deepActiveElement(host.ownerDocument);
	for (let turn = 0; ; turn += 1) {
		const focus = playerFocus.get(host);
		if (focus) return focus.focus(options, activeAtCall);
		if (!host.isConnected || turn >= MOUNT_WAIT_TURNS) return false;
		await Promise.resolve();
	}
}

/**
 * The `extend` step that gives the player element its `focus()`.
 *
 * A Svelte export would not do: Svelte exposes one as a getter that reads the
 * mounted instance, so before mount and after teardown `focus` would be
 * undefined and `player.focus()` would throw.
 */
export function withItemPlayerFocus<Base extends CustomElementConstructor>(
	ElementClass: Base,
): Base {
	return class extends ElementClass {
		/**
		 * Focus the first input of the rendered item; resolves whether focus moved. Each element is asked in document order through its `focusFirstInput()` hook, and one without the hook gets its first tabbable descendant; the passage is skipped. An item with no input leaves focus where it is. A call made while the item loads waits for `load-complete`, then focuses only if focus has not moved since the call. Call it on an explicit learner action, such as Enter or a Next button, not on load or as an answer is typed.
		 */
		focus(options?: FocusOptions): Promise<boolean> {
			return focusItemPlayer(this, options);
		}
	};
}
