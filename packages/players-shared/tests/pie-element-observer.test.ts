import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import {
	observePieElements,
	pieElementContextsWithin,
} from "../src/pie/element-observer.js";
import { initializePiesFromLoadedBundle } from "../src/pie/initialization.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity, Env } from "../src/types/index.js";

/**
 * happy-dom's MutationObserver delivers at most one batch per observer
 * reliably: a second delivery to the same observer, and a delivery to an
 * observer whose target mutates in a later tick than another observer's, are
 * both intermittently dropped (reproduced against happy-dom 20.11.1 at ~10% per
 * attempt). So every test here mutates the DOM once, in a single tick, and
 * flushes once. A test that needs a second delivery gets a fresh container.
 */

const ENV: Env = { mode: "gather", role: "student", partialScoring: false };

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

beforeEach(() => {
	document.body.innerHTML = "";
	(window as any).pie = undefined;
});

/**
 * Put `tags` in the shared registry as already-defined player.js elements,
 * which is what a host's own loader leaves behind: the tag is in
 * `customElements`, so `initializePiesFromLoadedBundle` takes its update-only
 * branch and needs no bundle module.
 */
const registerTags = (...tags: string[]): void => {
	const registry: Record<string, unknown> = {};
	for (const tag of tags) {
		registry[tag] = {
			package: `@pie-element/${tag}@1.0.0`,
			status: Status.loaded,
			tagName: tag,
			controller: null,
			bundleType: BundleType.player,
		};
		if (!customElements.get(tag)) {
			customElements.define(tag, class extends HTMLElement {});
		}
	}
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = registry;
};

const configFor = (tag: string, id: string): ConfigEntity => ({
	markup: `<${tag} id="${id}"></${tag}>`,
	elements: { [tag]: `@pie-element/${tag}@1.0.0` },
	models: [{ id, element: tag, prompt: `prompt for ${id}` }],
});

const makeContainer = (): HTMLElement => {
	const container = document.createElement("div");
	document.body.append(container);
	return container;
};

type BoundElement = HTMLElement & { model?: any; session?: any };

/** Create a PIE element and append it to `container`, without flushing. */
const appendPieElement = (
	container: Element,
	tag: string,
	id: string,
): BoundElement => {
	const element = document.createElement(tag) as BoundElement;
	element.id = id;
	container.append(element);
	return element;
};

const flushMutations = async (): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 0));
};

/**
 * What a player does on mount: bind what is already in its container, then
 * observe the container for what arrives later.
 */
const register = (
	config: ConfigEntity,
	container: Element,
	eventListeners?: Record<string, Record<string, (event: any) => void>>,
	session: any[] = [],
): (() => void) => {
	initializePiesFromLoadedBundle(config, session, {
		env: ENV,
		bundleType: BundleType.player,
		container,
		...(eventListeners ? { eventListeners } : {}),
	});
	return observePieElements(container, () => ({
		config,
		session,
		env: ENV,
		...(eventListeners ? { eventListeners } : {}),
	}));
};

describe("late-arriving PIE element binding", () => {
	test("binds elements inserted into each of two mounted players", async () => {
		const tagA = "pie-observer-two-players-a--version-1-0-0";
		const tagB = "pie-observer-two-players-b--version-1-0-0";
		registerTags(tagA, tagB);

		const containerA = makeContainer();
		const containerB = makeContainer();
		const releaseA = register(configFor(tagA, "a1"), containerA);
		const releaseB = register(configFor(tagB, "b1"), containerB);

		const elementA = appendPieElement(containerA, tagA, "a1");
		const elementB = appendPieElement(containerB, tagB, "b1");
		await flushMutations();

		// The single global context slot this replaced held only the most recent
		// registration, so the first player's late element never bound.
		expect(elementA.model?.prompt).toBe("prompt for a1");
		expect(elementA.session?.id).toBe("a1");
		expect(elementB.model?.prompt).toBe("prompt for b1");
		expect(elementB.session?.id).toBe("b1");

		releaseA();
		releaseB();
	});

	test("binds both players when each registers a new tag from a bundle", async () => {
		// Defining a new tag from a bundle module is the branch that used to
		// install the one document.body observer, and the second registration
		// overwrote the one context slot that observer read — so the first
		// player's late element failed the container check and never bound.
		const tagA = "pie-observer-bundle-a--version-1-0-0";
		const tagB = "pie-observer-bundle-b--version-1-0-0";
		(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {};
		(window as any).pie = {
			default: {
				[`@pie-element/${tagA}`]: { Element: class extends HTMLElement {} },
				[`@pie-element/${tagB}`]: { Element: class extends HTMLElement {} },
			},
		};

		const containerA = makeContainer();
		const containerB = makeContainer();
		const releaseA = register(configFor(tagA, "a1"), containerA);
		const releaseB = register(configFor(tagB, "b1"), containerB);
		await customElements.whenDefined(tagA);
		await customElements.whenDefined(tagB);

		const elementA = appendPieElement(containerA, tagA, "a1");
		const elementB = appendPieElement(containerB, tagB, "b1");
		await flushMutations();

		expect(elementA.model?.prompt).toBe("prompt for a1");
		expect(elementB.model?.prompt).toBe("prompt for b1");

		releaseA();
		releaseB();
	});

	test("binds a late element against each config registered for one container", async () => {
		// An item player registers its item config and its passage config against
		// the same container. Both have to stay reachable.
		const itemTag = "pie-observer-item-cfg--version-1-0-0";
		const passageTag = "pie-observer-passage-cfg--version-1-0-0";
		registerTags(itemTag, passageTag);

		const container = makeContainer();
		const releaseItem = register(configFor(itemTag, "item-1"), container);
		const releasePassage = register(
			configFor(passageTag, "passage-1"),
			container,
		);

		const itemElement = appendPieElement(container, itemTag, "item-1");
		const passageElement = appendPieElement(container, passageTag, "passage-1");
		await flushMutations();

		expect(itemElement.model?.prompt).toBe("prompt for item-1");
		expect(passageElement.model?.prompt).toBe("prompt for passage-1");

		releaseItem();
		releasePassage();
	});

	test("keeps observing a container while one of its registrations is released", async () => {
		const itemTag = "pie-observer-partial-item--version-1-0-0";
		const passageTag = "pie-observer-partial-passage--version-1-0-0";
		registerTags(itemTag, passageTag);

		const container = makeContainer();
		const releaseItem = register(configFor(itemTag, "item-1"), container);
		const releasePassage = register(
			configFor(passageTag, "passage-1"),
			container,
		);
		releaseItem();
		expect(pieElementContextsWithin(container)).toHaveLength(1);

		const passageElement = appendPieElement(container, passageTag, "passage-1");
		await flushMutations();
		expect(passageElement.model?.prompt).toBe("prompt for passage-1");

		releasePassage();
		expect(pieElementContextsWithin(container)).toHaveLength(0);
	});

	test("binds elements nested inside an added subtree", async () => {
		const tag = "pie-observer-nested--version-1-0-0";
		registerTags(tag);

		const container = makeContainer();
		const release = register(configFor(tag, "deep"), container);

		const wrapper = document.createElement("div");
		const inner = document.createElement("section");
		const element = document.createElement(tag) as BoundElement;
		element.id = "deep";
		inner.append(element);
		wrapper.append(inner);
		container.append(wrapper);
		await flushMutations();

		expect(element.model?.prompt).toBe("prompt for deep");
		release();
	});

	test("ignores insertions outside the registered container", async () => {
		const tag = "pie-observer-outside--version-1-0-0";
		registerTags(tag);

		const container = makeContainer();
		const outside = makeContainer();
		const release = register(configFor(tag, "outside-1"), container);

		const element = appendPieElement(outside, tag, "outside-1");
		await flushMutations();

		expect(element.model).toBeUndefined();
		expect(element.session).toBeUndefined();

		release();
	});

	test("stops binding once the registration is released", async () => {
		const tag = "pie-observer-released--version-1-0-0";
		registerTags(tag);

		const container = makeContainer();
		const release = register(configFor(tag, "gone"), container);
		release();
		release(); // idempotent

		const element = appendPieElement(container, tag, "gone");
		await flushMutations();

		expect(element.model).toBeUndefined();
		expect(pieElementContextsWithin(container)).toHaveLength(0);
	});

	test("applies each registration's own event listeners", async () => {
		const tagA = "pie-observer-listeners-a--version-1-0-0";
		const tagB = "pie-observer-listeners-b--version-1-0-0";
		registerTags(tagA, tagB);

		const containerA = makeContainer();
		const containerB = makeContainer();
		const seen: string[] = [];

		const releaseA = register(configFor(tagA, "la"), containerA, {
			[tagA]: { "session-changed": () => seen.push("a") },
		});
		// The observer callback used to close over the first registration's
		// options, so a later player's listeners were dropped.
		const releaseB = register(configFor(tagB, "lb"), containerB, {
			[tagB]: { "session-changed": () => seen.push("b") },
		});

		const elementA = appendPieElement(containerA, tagA, "la");
		const elementB = appendPieElement(containerB, tagB, "lb");
		await flushMutations();

		elementA.dispatchEvent(new CustomEvent("session-changed"));
		elementB.dispatchEvent(new CustomEvent("session-changed"));
		expect(seen).toEqual(["a", "b"]);

		releaseA();
		releaseB();
	});

	test("binds a late element against the session read now, not at registration", async () => {
		// The player registers its bundle with an empty session and fills the real
		// one afterwards, replacing the array when a parent recomputes it. A late
		// element has to see what the player holds now.
		const tag = "pie-observer-live-session--version-1-0-0";
		registerTags(tag);

		const container = makeContainer();
		let session: any[] = [];
		const config = configFor(tag, "live");
		initializePiesFromLoadedBundle(config, session, {
			env: ENV,
			bundleType: BundleType.player,
			container,
		});
		const release = observePieElements(container, () => ({
			config,
			session,
			env: ENV,
		}));
		// A different array, as `$derived` session props produce on recompute.
		session = [{ id: "live", element: tag, value: ["b"] }];

		const element = appendPieElement(container, tag, "live");
		await flushMutations();

		expect(element.session?.value).toEqual(["b"]);
		release();
	});

	test("loading a bundle does not observe anything by itself", async () => {
		// Observation is the container owner's resource. A loader that installed
		// one had no lifecycle to release it, which is how the old observer
		// outlived every player on the page.
		const tag = "pie-observer-loader-only--version-1-0-0";
		registerTags(tag);

		const container = makeContainer();
		initializePiesFromLoadedBundle(configFor(tag, "loader-1"), [], {
			env: ENV,
			bundleType: BundleType.player,
			container,
		});
		expect(pieElementContextsWithin(container)).toHaveLength(0);
		expect(pieElementContextsWithin(document.body)).toHaveLength(0);

		const element = appendPieElement(container, tag, "loader-1");
		await flushMutations();
		expect(element.model).toBeUndefined();
	});

	test("resolves a container's bindings from an ancestor node", () => {
		const tag = "pie-observer-ancestor--version-1-0-0";
		registerTags(tag);

		// A host holds the custom element it mounted; the player registers its own
		// inner root as the container.
		const host = makeContainer();
		const innerRoot = document.createElement("div");
		host.append(innerRoot);
		const config = configFor(tag, "anc");
		const release = register(config, innerRoot);

		const contexts = pieElementContextsWithin(host);
		expect(contexts).toHaveLength(1);
		expect(contexts[0].config).toBe(config);

		release();
		expect(pieElementContextsWithin(host)).toHaveLength(0);
	});
});
