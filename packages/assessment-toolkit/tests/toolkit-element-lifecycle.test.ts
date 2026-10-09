/**
 * `<pie-assessment-toolkit>` mounted in happy-dom: the lifecycle edges that only
 * its effects reach.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { commitPendingSessions } = await import("@pie-players/pie-players-shared");
await import("../src/components/PieAssessmentToolkit.svelte");

const OBSERVED_EVENTS = [
	"runtime-ready",
	"framework-error",
	"pie-stage-change",
	"pie-loading-complete",
	"toolkit-ready",
	"section-ready",
	"composition-changed",
] as const;

type ToolkitElement = HTMLElement & Record<string, unknown>;

interface Mounted {
	element: ToolkitElement;
	events: Array<{ type: string; detail: any }>;
	hookCalls: Array<{ kind: string }>;
	of(type: string): Array<{ type: string; detail: any }>;
}

async function settle(rounds = 20): Promise<void> {
	for (let round = 0; round < rounds; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

function section(identifier: string) {
	return { identifier, assessmentItemRefs: [] };
}

/** A controller stub; `initialize` decides whether the section starts. */
function controller(initialize: () => Promise<void> = async () => {}) {
	return {
		initialize,
		getSession: () => null,
		subscribe: () => () => {},
		dispose: async () => {},
	};
}

/** A controller stub that announces each item session it is handed. */
function sessionController() {
	const listeners = new Set<(event: unknown) => void>();
	return {
		...controller(),
		subscribe: (listener: (event: unknown) => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		updateItemSession: (itemId: string, session: unknown) => {
			for (const listener of listeners) {
				listener({ type: "item-session-data-changed", itemId, session });
			}
			return null;
		},
	};
}

/**
 * An item shell holding a delivery element whose response it has not announced,
 * forwarding the element's `session-changed` to the toolkit as a shell does.
 */
function shellWithPendingResponse(runtimeId: string, itemId: string) {
	const shell = document.createElement("div");
	const delivery = Object.assign(document.createElement("x-delivery"), {
		model: {},
		session: { id: itemId, data: [{ id: "choice", value: ["a"] }] },
	});
	shell.append(delivery);
	shell.addEventListener("session-changed", (event) => {
		event.stopPropagation();
		shell.dispatchEvent(
			new CustomEvent("pie-item-session-changed", {
				bubbles: true,
				composed: true,
				detail: { itemId, session: (event as CustomEvent).detail, runtimeId },
			}),
		);
	});
	return shell;
}

/** An item scope inside `toolkit`, registering as an item shell does. */
function registerItem(toolkit: HTMLElement, itemId: string): void {
	const item = document.createElement("div");
	toolkit.append(item);
	item.dispatchEvent(
		new CustomEvent("pie-register", {
			bubbles: true,
			composed: true,
			detail: { kind: "item", itemId, element: item },
		}),
	);
}

const mounted: Mounted[] = [];

async function mount(props: Record<string, unknown>): Promise<Mounted> {
	const element = document.createElement(
		"pie-assessment-toolkit",
	) as ToolkitElement;
	const events: Mounted["events"] = [];
	const hookCalls: Mounted["hookCalls"] = [];
	for (const type of OBSERVED_EVENTS) {
		element.addEventListener(type, (event) => {
			events.push({ type, detail: (event as CustomEvent).detail });
		});
	}
	element.onFrameworkError = (model: { kind: string }) => hookCalls.push(model);
	element.assessmentId = "assessment-1";
	Object.assign(element, props);
	document.body.append(element);
	await settle();
	const result: Mounted = {
		element,
		events,
		hookCalls,
		of: (type) => events.filter((event) => event.type === type),
	};
	mounted.push(result);
	return result;
}

afterEach(async () => {
	for (const { element } of mounted.splice(0)) element.remove();
	await settle(2);
});

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

describe("<pie-assessment-toolkit> lifecycle", () => {
	test("emits no stage events: the section player's kernel owns the stage chain", async () => {
		const { of } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => controller(),
		});
		expect(of("toolkit-ready")).toHaveLength(1);
		expect(of("pie-stage-change")).toEqual([]);
	});

	test("a toolkit without a section emits no stage events when its first item registers", async () => {
		const { element, of } = await mount({});
		registerItem(element, "item-1");
		await settle();
		const [runtimeReady] = of("runtime-ready");
		expect(runtimeReady?.detail.coordinator.isReady()).toBe(true);
		expect(of("pie-stage-change")).toEqual([]);
	});

	test("a toolkit without a section binds its first item to a coordinator built from inputs changed before it", async () => {
		const { element, of } = await mount({});
		element.assessmentId = "assessment-2";
		await settle();
		registerItem(element, "item-1");
		await settle();

		const coordinator = of("runtime-ready").at(-1)?.detail.coordinator;
		expect(coordinator.assessmentId).toBe("assessment-2");
		expect(coordinator.isReady()).toBe(true);
	});

	test("a toolkit without a section keeps the coordinator its first item bound, and reports a later change once", async () => {
		const warnings: string[] = [];
		const warn = console.warn;
		console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "));
		try {
			const { element, of } = await mount({});
			registerItem(element, "item-1");
			await settle();
			const bound = of("runtime-ready").at(-1)?.detail.coordinator;

			element.assessmentId = "assessment-2";
			await settle();
			element.assessmentId = "assessment-3";
			await settle();

			expect(of("runtime-ready").at(-1)?.detail.coordinator).toBe(bound);
			expect(bound.assessmentId).toBe("assessment-1");
			const late = warnings.filter((message) =>
				message.includes("changed after an item registered"),
			);
			expect(late).toHaveLength(1);
			expect(late[0]).toContain("assessmentId");
		} finally {
			console.warn = warn;
		}
	});

	test("leaving a section commits its pending response to the host's subscription", async () => {
		const { element, of } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => sessionController(),
		});
		const [{ detail: ready }] = of("toolkit-ready");
		const received: Array<{ type: string; itemId: string }> = [];
		ready.coordinator.subscribeItemEvents({
			listener: ({ type, itemId }: { type: string; itemId: string }) =>
				received.push({ type, itemId }),
		});
		element.append(shellWithPendingResponse(ready.runtimeId, "item-1"));

		Object.assign(element, { sectionId: "s2", section: section("s2") });
		await settle();

		expect(of("toolkit-ready").map((event) => event.detail.sectionId)).toEqual([
			"s1",
			"s2",
		]);
		expect(received).toEqual([
			{ type: "item-session-data-changed", itemId: "item-1" },
		]);
	});

	test("a session set for a section still starting never reaches the next section", async () => {
		const applied: Array<{ sectionId: string; session: unknown }> = [];
		let releaseFirst: () => void = () => {};
		const firstStarted = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const sectionIds = ["s1", "s2"];
		const { element } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => {
				const sectionId = sectionIds.shift() as string;
				return {
					...controller(sectionId === "s1" ? () => firstStarted : undefined),
					applySession: async (session: unknown) => {
						applied.push({ sectionId, session });
					},
				};
			},
		});
		element.session = {
			itemSessions: { "s1-q1": { id: "s1-q1", data: [{ id: "a", value: ["x"] }] } },
		};
		await settle();

		Object.assign(element, { sectionId: "s2", section: section("s2") });
		await settle();
		releaseFirst();
		await settle();

		expect(applied.map(({ sectionId }) => sectionId)).not.toContain("s2");
	});

	test("a check on an item whose ref is not its item id reaches the controller", async () => {
		// The composition keys the renderable by its item id; the controller keys
		// formative state by the ref identifier the card names as canonical.
		const tries: string[] = [];
		const { element } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => ({
				...controller(),
				getCompositionModel: () => ({
					section: section("s1"),
					renderables: [{ flavor: "item", entity: { id: "item-1" } }],
				}),
				recordFormativeTry: ({ itemId }: { itemId: string }) => tries.push(itemId),
			}),
		});
		const card = document.createElement("div");
		element.append(card);
		card.dispatchEvent(
			new CustomEvent("pie-formative-action", {
				bubbles: true,
				composed: true,
				detail: { itemId: "item-1", canonicalItemId: "ref-1", action: "check", outcomes: [] },
			}),
		);

		expect(tries).toEqual(["ref-1"]);
	});

	test("each section's composition is published before its section-ready", async () => {
		const composing = (sectionId: string) => ({
			...controller(),
			getCompositionModel: () => ({
				section: section(sectionId),
				renderables: [{ flavor: "item", entity: { id: `${sectionId}-q1` } }],
			}),
		});
		const sectionIds = ["s1", "s2"];
		const { element, events } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => composing(sectionIds.shift() as string),
		});
		Object.assign(element, { sectionId: "s2", section: section("s2") });
		await settle();

		const order = events.flatMap(({ type, detail }) => {
			if (type === "section-ready") return [`ready:${detail.sectionId}`];
			if (type === "composition-changed") {
				return [`composition:${detail.composition.section.identifier}`];
			}
			return [];
		});
		expect(order).toEqual([
			"composition:s1",
			"ready:s1",
			"composition:s2",
			"ready:s2",
		]);
	});

	test("a response the host committed before leaving the section reaches it once", async () => {
		const { element, of } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => sessionController(),
		});
		const [{ detail: ready }] = of("toolkit-ready");
		const received: string[] = [];
		ready.coordinator.subscribeItemEvents({
			listener: ({ itemId }: { itemId: string }) => received.push(itemId),
		});
		element.append(shellWithPendingResponse(ready.runtimeId, "item-1"));

		commitPendingSessions(element, { reason: "navigate" });
		Object.assign(element, { sectionId: "s2", section: section("s2") });
		await settle();

		expect(received).toEqual(["item-1"]);
	});

	test("a section that starts takes down the banner the previous section's failure raised", async () => {
		let created = 0;
		const { element, of } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () => {
				created += 1;
				return created === 1
					? controller(async () => {
							throw new Error("s1 failed to start");
						})
					: controller();
			},
		});
		const banner = () =>
			element.shadowRoot?.querySelector(".pie-assessment-toolkit-error") ?? null;
		expect(banner()).not.toBeNull();

		Object.assign(element, { sectionId: "s2", section: section("s2") });
		await settle();

		expect(of("toolkit-ready").map((event) => event.detail.sectionId)).toEqual([
			"s2",
		]);
		expect(banner()).toBeNull();
	});

	test("isolation=\"force\" as an attribute gives a nested toolkit its own coordinator", async () => {
		const outer = await mount({});
		const inner = document.createElement("pie-assessment-toolkit") as ToolkitElement;
		const ready: Array<{ ownership: string; coordinator: unknown }> = [];
		inner.addEventListener("runtime-ready", (event) => {
			ready.push((event as CustomEvent).detail);
		});
		inner.setAttribute("isolation", "force");
		inner.assessmentId = "assessment-1";
		outer.element.append(inner);
		await settle();

		const [outerReady] = outer.of("runtime-ready");
		expect(ready.map((detail) => detail.ownership)).toEqual(["owned"]);
		expect(ready[0]?.coordinator).not.toBe(outerReady?.detail.coordinator);
	});

	test("one controller-init failure is one framework-error and one hook call", async () => {
		const { of, hookCalls } = await mount({
			sectionId: "s1",
			section: section("s1"),
			createSectionController: () =>
				controller(async () => {
					throw new Error("controller init failed");
				}),
		});
		const errors = of("framework-error");
		expect(errors.map((event) => event.detail.kind)).toEqual([
			"section-controller-init",
		]);
		expect(hookCalls.map((model) => model.kind)).toEqual([
			"section-controller-init",
		]);
	});
});
