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
