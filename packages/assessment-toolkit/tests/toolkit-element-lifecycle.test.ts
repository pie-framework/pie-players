/**
 * `<pie-assessment-toolkit>` mounted in happy-dom: the lifecycle edges that only
 * its effects reach.
 *
 * The element loads from its build, so rebuild the package before running this
 * file. pie-context's event classes extend the `Event` of the moment the module
 * first loads, and a `dispatchEvent` accepts only its own realm's events, so this
 * file re-bases them onto happy-dom's `Event` while it runs and puts back the
 * base the rest of the run expects when it ends.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, describe, expect, test } from "bun:test";

const NativeEvent = globalThis.Event;
const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();
const { ContextProviderEvent, ContextRequestEvent } = await import(
	"@pie-players/pie-context"
);
const { commitPendingSessions } = await import("@pie-players/pie-players-shared");
await import("../dist/components/pie-assessment-toolkit-element.js");

type EventClass = { prototype: Event };
function rebase(eventClass: EventClass, base: EventClass): void {
	Object.setPrototypeOf(eventClass, base);
	Object.setPrototypeOf(eventClass.prototype, base.prototype);
}
const rebased = [ContextRequestEvent, ContextProviderEvent].map((eventClass) => {
	const base = Object.getPrototypeOf(eventClass) as EventClass;
	// Loaded by this file: the rest of the run expects the native base.
	const restore = base === window.Event ? NativeEvent : base;
	rebase(eventClass, window.Event);
	return { eventClass, restore };
});

const OBSERVED_EVENTS = [
	"runtime-ready",
	"framework-error",
	"pie-stage-change",
	"pie-loading-complete",
	"toolkit-ready",
	"section-ready",
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
	for (const { eventClass, restore } of rebased) rebase(eventClass, restore);
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
		const item = document.createElement("div");
		element.append(item);
		item.dispatchEvent(
			new CustomEvent("pie-register", {
				bubbles: true,
				composed: true,
				detail: { kind: "item", itemId: "item-1", element: item },
			}),
		);
		await settle();
		const [runtimeReady] = of("runtime-ready");
		expect(runtimeReady?.detail.coordinator.isReady()).toBe(true);
		expect(of("pie-stage-change")).toEqual([]);
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
