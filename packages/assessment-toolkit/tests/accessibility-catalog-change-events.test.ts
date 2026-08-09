import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";
import type { CatalogChangeEvent } from "../src/services/AccessibilityCatalogResolver";
import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const catalog = (identifier: string): AccessibilityCatalog => ({
	identifier,
	cards: [{ catalog: "spoken", language: "en-US", content: "<speak>hi</speak>" }],
});

const itemContext = { ownerKind: "itemModel" as const, itemId: "item-1" };

/**
 * The signal a catalog-rendering reader needs. Registration is driven by an item
 * shell's mount event, so a card rendered alongside the item computes its first
 * "is there a card for me" answer before the catalogs exist. Without this the
 * only options are polling on a deadline or missing the content silently — and
 * for an accommodation, silently missing it is invisible to everyone except the
 * learner who needed it.
 */
describe("catalog change events", () => {
	test("fires when scoped catalogs are registered", () => {
		const resolver = new AccessibilityCatalogResolver();
		const events: CatalogChangeEvent[] = [];
		resolver.onCatalogsChange((event) => events.push(event));

		resolver.registerCatalogs(itemContext, [catalog("c1")]);

		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("scoped-registered");
		expect(events[0].context).toEqual(itemContext);
	});

	test("a listener that re-queries on the event sees the new catalogs", () => {
		// The whole contract: the event fires *after* the mutation, so re-querying
		// from the listener is the intended use rather than a race.
		const resolver = new AccessibilityCatalogResolver();
		let resolvedDuringEvent: string | undefined;
		resolver.onCatalogsChange(() => {
			resolvedDuringEvent = resolver.getAlternative("c1", {
				type: "spoken",
				context: itemContext,
			})?.catalogId;
		});

		resolver.registerCatalogs(itemContext, [catalog("c1")]);

		expect(resolvedDuringEvent).toBe("c1");
	});

	test("fires when the registration disposer removes them again", () => {
		const resolver = new AccessibilityCatalogResolver();
		const unregister = resolver.registerCatalogs(itemContext, [catalog("c1")]);
		const events: CatalogChangeEvent[] = [];
		resolver.onCatalogsChange((event) => events.push(event));

		unregister();

		expect(events).toHaveLength(1);
		expect(events[0].reason).toBe("scoped-removed");
		expect(events[0].context).toEqual(itemContext);
	});

	test("stays silent when a registration inserts nothing", () => {
		// An all-duplicates call changes no state. Waking every reader to re-resolve
		// for it would make the signal something consumers learn to distrust.
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(itemContext, [catalog("c1")]);
		const events: CatalogChangeEvent[] = [];
		resolver.onCatalogsChange((event) => events.push(event));

		resolver.registerCatalogs(itemContext, [catalog("c1")]);
		resolver.registerCatalogs(itemContext, []);
		resolver.registerCatalogs(itemContext, undefined);

		expect(events).toEqual([]);
	});

	test("fires for item-level catalogs being added and cleared", () => {
		const resolver = new AccessibilityCatalogResolver();
		const events: CatalogChangeEvent[] = [];
		resolver.onCatalogsChange((event) => events.push(event));

		resolver.addItemCatalogs([catalog("i1")]);
		resolver.clearItemCatalogs();

		expect(events.map((event) => event.reason)).toEqual([
			"item-added",
			"item-cleared",
		]);
	});

	test("stays silent clearing item catalogs that were never there", () => {
		const resolver = new AccessibilityCatalogResolver();
		const events: CatalogChangeEvent[] = [];
		resolver.onCatalogsChange((event) => events.push(event));

		resolver.clearItemCatalogs();

		expect(events).toEqual([]);
	});

	test("unsubscribing stops delivery", () => {
		const resolver = new AccessibilityCatalogResolver();
		const events: CatalogChangeEvent[] = [];
		const unsubscribe = resolver.onCatalogsChange((event) => events.push(event));

		unsubscribe();
		resolver.registerCatalogs(itemContext, [catalog("c1")]);

		expect(events).toEqual([]);
	});

	test("a throwing listener does not break registration or its neighbours", () => {
		const resolver = new AccessibilityCatalogResolver();
		const reached: string[] = [];
		resolver.onCatalogsChange(() => {
			throw new Error("subscriber blew up");
		});
		resolver.onCatalogsChange(() => reached.push("second"));

		expect(() =>
			resolver.registerCatalogs(itemContext, [catalog("c1")]),
		).not.toThrow();
		expect(reached).toEqual(["second"]);
		// The registration itself still took effect.
		expect(
			resolver.getAlternative("c1", { type: "spoken", context: itemContext }),
		).not.toBeNull();
	});

	test("a listener unsubscribing during dispatch does not skip its neighbours", () => {
		const resolver = new AccessibilityCatalogResolver();
		const reached: string[] = [];
		const unsubscribeFirst = resolver.onCatalogsChange(() => {
			reached.push("first");
			unsubscribeFirst();
		});
		resolver.onCatalogsChange(() => reached.push("second"));

		resolver.registerCatalogs(itemContext, [catalog("c1")]);

		expect(reached).toEqual(["first", "second"]);
	});

	test("supports several independent subscribers", () => {
		const resolver = new AccessibilityCatalogResolver();
		let a = 0;
		let b = 0;
		resolver.onCatalogsChange(() => {
			a += 1;
		});
		const unsubscribeB = resolver.onCatalogsChange(() => {
			b += 1;
		});

		resolver.registerCatalogs(itemContext, [catalog("c1")]);
		unsubscribeB();
		resolver.registerCatalogs(itemContext, [catalog("c2")]);

		expect(a).toBe(2);
		expect(b).toBe(1);
	});
});
