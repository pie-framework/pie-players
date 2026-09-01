/**
 * Binding PIE elements that arrive after their bundle was registered.
 *
 * A bundle registration binds models and sessions to the PIE elements present
 * in its container at registration time. Elements that arrive afterwards — ones
 * a host appends to authored markup after the player mounted, or ones a tag's
 * own render pass paints into its subtree — are bound by a `MutationObserver`.
 *
 * The observer is scoped to the registration's container, so a mutation
 * elsewhere on the host page never reaches the callback and no `contains()`
 * walk is needed to reject one. One observer serves every registration made
 * against the same container — an item player registers its item config and its
 * passage config separately — and it disconnects when the last of those
 * registrations is released.
 *
 * This replaces a pair of `window` globals: one observer on `document.body` for
 * the lifetime of the page, and one context slot that every registration
 * overwrote. With a single slot the second registration displaced the first, so
 * a late passage element, or any element in a player that was not the most
 * recently registered, silently never bound.
 */

import type { ConfigEntity, Env } from "../types/index.js";
import { initializePieElement } from "./initialize-element.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
import { pieRegistry } from "./registry.js";
import type { EventListenersMap, PieElement } from "./types.js";

const logger = createPieLogger("pie-element-observer", () =>
	isGlobalDebugEnabled(),
);

/**
 * What one registration binds a PIE element with.
 */
export interface PieElementContext {
	config: ConfigEntity;
	session: any[];
	env?: Env;
	eventListeners?: EventListenersMap;
}

/**
 * Reads the context to bind with.
 *
 * Called when an element arrives, not when the registration is made: a player
 * recomputes its session and env on render, so a value captured at
 * registration time is stale by the time a late element needs it.
 */
export type PieElementContextSource = () => PieElementContext;

type ObservedContainer = {
	sources: Set<PieElementContextSource>;
	observer: MutationObserver;
};

const observed = new Map<Element | Document, ObservedContainer>();

const resolveContexts = (
	sources: Iterable<PieElementContextSource>,
): PieElementContext[] => {
	const contexts: PieElementContext[] = [];
	for (const source of sources) {
		try {
			contexts.push(source());
		} catch (error) {
			logger.error(
				"[pieElementObserver] A context source threw; skipping it.",
				error,
			);
		}
	}
	return contexts;
};

const bindElement = (
	element: Element,
	contexts: PieElementContext[],
): void => {
	const tagName = element.tagName.toLowerCase();
	if (!pieRegistry()[tagName]) return;
	for (const context of contexts) {
		const bound = initializePieElement(element as PieElement, {
			config: context.config,
			session: context.session,
			env: context.env,
			eventListeners: context.eventListeners?.[tagName],
		});
		if (bound) return;
	}
};

const handleMutations = (
	sources: Set<PieElementContextSource>,
	mutations: MutationRecord[],
): void => {
	// Resolved once per delivery, not per element.
	const contexts = resolveContexts(sources);
	if (contexts.length === 0) return;
	for (const mutation of mutations) {
		if (mutation.type !== "childList") continue;
		for (const node of mutation.addedNodes) {
			if (node.nodeType !== Node.ELEMENT_NODE) continue;
			const element = node as Element;
			bindElement(element, contexts);
			for (const descendant of Array.from(element.querySelectorAll("*"))) {
				bindElement(descendant, contexts);
			}
		}
	}
};

/**
 * Watch `container` for late-arriving PIE elements and bind them with whatever
 * `getContext` returns at that moment. `container` defaults to `document.body`,
 * matching an unscoped `LoadPieElementsOptions.container`.
 *
 * Returns the release for this registration. Calling it more than once is a
 * no-op; the observer disconnects once every registration against the container
 * has been released, so the caller that acquired it owns it.
 */
export const observePieElements = (
	container: Element | Document | undefined,
	getContext: PieElementContextSource,
): (() => void) => {
	if (
		typeof document === "undefined" ||
		typeof MutationObserver === "undefined"
	) {
		return () => {};
	}
	const target = container ?? document.body;
	if (!target) return () => {};

	let entry = observed.get(target);
	if (!entry) {
		const sources = new Set<PieElementContextSource>();
		const observer = new MutationObserver((mutations) =>
			handleMutations(sources, mutations),
		);
		observer.observe(target, { childList: true, subtree: true });
		entry = { sources, observer };
		observed.set(target, entry);
		logger.debug("[observePieElements] Observing a new container");
	}

	const { sources, observer } = entry;
	sources.add(getContext);
	logger.debug(
		`[observePieElements] Container now has ${sources.size} registration(s)`,
	);

	let released = false;
	return () => {
		if (released) return;
		released = true;
		sources.delete(getContext);
		if (sources.size > 0) return;
		observer.disconnect();
		observed.delete(target);
		logger.debug(
			"[observePieElements] Released the last registration, disconnected",
		);
	};
};

/**
 * The contexts registered for `root` or for any container inside it, resolved
 * now, in registration order.
 *
 * A host holds the custom element it mounted while the player registers its own
 * inner root as the container, so the lookup accepts an ancestor of the
 * container.
 */
export const pieElementContextsWithin = (
	root: Element | Document,
): PieElementContext[] => {
	const sources: PieElementContextSource[] = [];
	for (const [container, entry] of observed) {
		if (container !== root && !root.contains(container as Node)) continue;
		sources.push(...entry.sources);
	}
	return resolveContexts(sources);
};
