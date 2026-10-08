/**
 * The harness builds its tree from raw `EventTarget` nodes, as
 * `runtime/section-runtime-engine-host-context.test.ts` uses raw targets:
 * happy-dom's `dispatchEvent` rejects pie-context's events whenever another
 * file loaded pie-context first, its classes extending the `Event` of that
 * moment. A node dispatches to itself and then to each ancestor until a
 * listener stops propagation, which is what the context protocol relies on, and
 * `ownerDocument` names the tree's top node as its document element, where
 * pie-context installs the document's context root.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
	ContextProvider,
	ContextRequestEvent,
} from "@pie-players/pie-context";
import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";
import {
	type AssessmentToolkitHostRuntimeContext,
	assessmentToolkitHostRuntimeContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitShellContext,
} from "../src/context/assessment-toolkit-context.js";
import {
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
} from "../src/runtime/registration-events.js";
import { createShellScope } from "../src/runtime/shell-scope.js";

type FakeDocument = { documentElement: FakeNode };

class FakeNode extends EventTarget {
	readonly #attributes = new Map<string, string>();
	readonly parent: FakeNode | null;
	readonly ownerDocument: FakeDocument;

	constructor(parent: FakeNode | null) {
		super();
		this.parent = parent;
		this.ownerDocument = parent?.ownerDocument ?? { documentElement: this };
	}

	getAttribute(name: string): string | null {
		return this.#attributes.get(name) ?? null;
	}

	setAttribute(name: string, value: string): void {
		this.#attributes.set(name, String(value));
	}

	override dispatchEvent(event: Event): boolean {
		// Each node is a separate native dispatch, which clears the stop flag
		// when it returns, so the stop is recorded here. Calling the native one
		// as well keeps `cancelBubble` true for the node's later listeners.
		let stopped = false;
		const stopPropagation = Event.prototype.stopPropagation;
		Object.defineProperty(event, "stopPropagation", {
			configurable: true,
			value: () => {
				stopped = true;
				stopPropagation.call(event);
			},
		});
		let notCanceled = true;
		for (
			let node: FakeNode | null = this;
			node && !stopped;
			node = event.bubbles ? node.parent : null
		) {
			notCanceled = EventTarget.prototype.dispatchEvent.call(node, event);
		}
		return notCanceled;
	}
}

const element = (node: FakeNode) => node as unknown as HTMLElement;

const spokenCatalog = (
	identifier: string,
	content: string,
): AccessibilityCatalog => ({
	identifier,
	cards: [{ catalog: "spoken", language: "en-US", content }],
});

const item = (content: string) => ({
	id: "q1",
	accessibilityCatalogs: [spokenCatalog("q1-stem", content)],
	config: { models: [] },
});

const scopes: Array<ReturnType<typeof createShellScope>> = [];
const runtimes: Array<() => void> = [];

afterEach(() => {
	for (const scope of scopes.splice(0)) {
		scope.retire();
		scope.disconnect();
	}
	for (const stop of runtimes.splice(0)) stop();
});

const runtimeValue = (runtimeId: string, coordinator: unknown = {}) =>
	({ runtimeId, coordinator }) as unknown as AssessmentToolkitHostRuntimeContext;

/** A toolkit on `node`, providing its host runtime context as the toolkit does. */
const provideRuntime = (node: FakeNode, runtimeId = "runtime-1") => {
	const provider = new ContextProvider(element(node), {
		context: assessmentToolkitHostRuntimeContext,
		initialValue: runtimeValue(runtimeId),
	});
	provider.connect();
	runtimes.push(() => provider.disconnect());
	return provider;
};

type Dispatched = {
	type: string;
	itemId: string;
	item: unknown;
	runtimeId?: string;
};

/**
 * A shell host inside a runtime node unless `runtime` is false, a tool and a
 * region inside the host, and the registrations that reach the runtime node.
 */
const setup = ({ runtime = true } = {}) => {
	const page = new FakeNode(null);
	const runtimeNode = new FakeNode(page);
	const shellNode = new FakeNode(runtimeNode);
	const host = element(shellNode);
	const tool = element(new FakeNode(shellNode));
	const content = element(new FakeNode(shellNode));
	if (runtime) provideRuntime(runtimeNode);
	const registrations: Dispatched[] = [];
	for (const type of [PIE_REGISTER_EVENT, PIE_UNREGISTER_EVENT]) {
		runtimeNode.addEventListener(type, (event) => {
			const detail = (event as CustomEvent).detail;
			registrations.push({
				type,
				itemId: detail.itemId,
				item: detail.item,
				runtimeId: detail.runtimeId,
			});
		});
	}
	const scope = createShellScope();
	scopes.push(scope);
	return { page, runtimeNode, shellNode, host, tool, content, registrations, scope };
};

/** Every value `tool` is given for `context`, as a subscribed tool sees them. */
const subscribe = <T>(tool: HTMLElement, context: unknown): T[] => {
	const values: T[] = [];
	tool.dispatchEvent(
		new ContextRequestEvent(
			context as never,
			tool,
			(value: unknown) => values.push(value as T),
			true,
		),
	);
	return values;
};

const steps = (registrations: Dispatched[]) =>
	registrations.map(({ type, itemId, runtimeId }) => [type, itemId, runtimeId]);

/** The `type` events reaching `node`, as their details. */
const received = (node: FakeNode, type: string) => {
	const details: Array<Record<string, unknown>> = [];
	node.addEventListener(type, (event) =>
		details.push((event as CustomEvent).detail),
	);
	return details;
};

const q1 = {
	kind: "item" as const,
	itemId: "q1",
	contentKind: "assessment-item",
};

describe("createShellScope", () => {
	test("gives the tools inside it the item's identity and region, and registers the item", () => {
		const { host, tool, registrations, scope } = setup();
		const first = item("Read me");
		scope.publish({
			host,
			kind: "item",
			itemId: "q1",
			contentKind: "assessment-item",
			item: first,
		});

		const [shell] = subscribe<{
			itemId: string;
			canonicalItemId: string;
			scopeElement: HTMLElement;
			item: unknown;
		}>(tool, assessmentToolkitShellContext);
		const [region] = subscribe<{ scopeElement: HTMLElement }>(
			tool,
			assessmentToolkitRegionScopeContext,
		);
		expect(shell).toMatchObject({
			itemId: "q1",
			canonicalItemId: "q1",
			scopeElement: host,
			item: first,
		});
		expect(region.scopeElement).toBe(host);
		expect(host.getAttribute("data-pie-shell-root")).toBe("item");
		expect(registrations).toEqual([
			{
				type: PIE_REGISTER_EVENT,
				itemId: "q1",
				item: first,
				runtimeId: "runtime-1",
			},
		]);
	});

	test("acts on the region the host names", () => {
		const { host, tool, content, scope } = setup();
		scope.publish({
			host,
			kind: "item",
			itemId: "q1",
			contentKind: "assessment-item",
			scopeElement: content,
		});

		const [region] = subscribe<{ scopeElement: HTMLElement }>(
			tool,
			assessmentToolkitRegionScopeContext,
		);
		expect(region.scopeElement).toBe(content);
	});

	test("publishes nothing for the same content republished as a new object", () => {
		const { host, tool, registrations, scope } = setup();
		const state = {
			host,
			kind: "item" as const,
			itemId: "q1",
			contentKind: "assessment-item",
		};
		scope.publish({ ...state, item: item("Read me") });
		const shells = subscribe(tool, assessmentToolkitShellContext);

		scope.publish({ ...state, item: item("Read me") });
		expect(shells).toHaveLength(1);
		expect(registrations).toHaveLength(1);

		const changed = item("Read this instead");
		scope.publish({ ...state, item: changed });
		expect(shells).toHaveLength(2);
		expect(registrations.at(-1)).toEqual({
			type: PIE_REGISTER_EVENT,
			itemId: "q1",
			item: changed,
			runtimeId: "runtime-1",
		});
	});

	test("registers nothing without an item id, and retires under the identity it registered", () => {
		const { host, registrations, scope } = setup();
		const state = { host, kind: "item" as const, contentKind: "assessment-item" };
		scope.publish({ ...state, itemId: "" });
		expect(registrations).toEqual([]);

		scope.publish({ ...state, itemId: "q1" });
		scope.retire();
		expect(steps(registrations)).toEqual([
			[PIE_REGISTER_EVENT, "q1", "runtime-1"],
			[PIE_UNREGISTER_EVENT, "q1", "runtime-1"],
		]);
	});

	test("registers once a runtime that connects after it answers through the document root", () => {
		const { page, runtimeNode, host, registrations, scope } = setup({
			runtime: false,
		});
		scope.publish({ host, ...q1 });
		expect(registrations).toEqual([]);
		expect(
			(page.ownerDocument as unknown as Record<symbol, unknown>)[
				Symbol.for("pie.context.documentRoot")
			],
		).toBeDefined();

		provideRuntime(runtimeNode);
		expect(steps(registrations)).toEqual([
			[PIE_REGISTER_EVENT, "q1", "runtime-1"],
		]);
	});

	test("says nothing new when its runtime republishes under the same id", () => {
		const { runtimeNode, host, registrations, scope } = setup({
			runtime: false,
		});
		const runtime = provideRuntime(runtimeNode);
		scope.publish({ host, ...q1 });
		runtime.setValue(runtimeValue("runtime-1", { replaced: true }));
		runtime.setValue(runtimeValue("runtime-1", { replacedAgain: true }));

		expect(steps(registrations)).toEqual([
			[PIE_REGISTER_EVENT, "q1", "runtime-1"],
		]);
	});

	test("moves its registration to a nearer runtime that connects later", () => {
		const page = new FakeNode(null);
		const outer = new FakeNode(page);
		const inner = new FakeNode(outer);
		const shellNode = new FakeNode(inner);
		const host = element(shellNode);
		provideRuntime(outer, "runtime-outer");
		const reachingOuter = received(outer, PIE_UNREGISTER_EVENT);
		const registrations: Dispatched[] = [];
		for (const type of [PIE_REGISTER_EVENT, PIE_UNREGISTER_EVENT]) {
			shellNode.addEventListener(type, (event) => {
				const detail = (event as CustomEvent).detail;
				registrations.push({
					type,
					itemId: detail.itemId,
					item: detail.item,
					runtimeId: detail.runtimeId,
				});
			});
		}
		const scope = createShellScope();
		scopes.push(scope);
		scope.publish({ host, ...q1 });

		// The outer runtime hands its subscribers to the new one, which answers
		// the shell as its nearer provider.
		provideRuntime(inner, "runtime-inner");
		expect(steps(registrations)).toEqual([
			[PIE_REGISTER_EVENT, "q1", "runtime-outer"],
			[PIE_UNREGISTER_EVENT, "q1", "runtime-outer"],
			[PIE_REGISTER_EVENT, "q1", "runtime-inner"],
		]);
		// Nothing on `inner` claims, so the unregister reaches the runtime it names.
		expect(reachingOuter.map((detail) => detail.runtimeId)).toEqual([
			"runtime-outer",
		]);

		scope.retire();
		expect(steps(registrations).at(-1)).toEqual([
			PIE_UNREGISTER_EVENT,
			"q1",
			"runtime-inner",
		]);
	});

	test("holds what it sends until a runtime answers, then delivers it in order", () => {
		const { runtimeNode, host, registrations, scope } = setup({
			runtime: false,
		});
		const loaded = received(runtimeNode, "pie-content-loaded");
		const order: string[] = [];
		runtimeNode.addEventListener(PIE_REGISTER_EVENT, () => order.push("register"));
		runtimeNode.addEventListener("pie-content-loaded", () => order.push("loaded"));

		scope.publish({ host, ...q1 });
		scope.send("pie-content-loaded", { itemId: "q1", step: 1 });
		scope.send("pie-content-loaded", { itemId: "q1", step: 2 });
		expect(loaded).toEqual([]);

		provideRuntime(runtimeNode);
		expect(loaded).toEqual([
			{ itemId: "q1", step: 1, runtimeId: "runtime-1" },
			{ itemId: "q1", step: 2, runtimeId: "runtime-1" },
		]);
		expect(order).toEqual(["register", "loaded", "loaded"]);
		expect(registrations).toHaveLength(1);

		scope.send("pie-content-loaded", { itemId: "q1", step: 3 });
		expect(loaded.at(-1)).toEqual({
			itemId: "q1",
			step: 3,
			runtimeId: "runtime-1",
		});
	});

	test("holds the newest fifty events it sends before a runtime answers", () => {
		const { runtimeNode, host, scope } = setup({ runtime: false });
		const loaded = received(runtimeNode, "pie-content-loaded");
		scope.publish({ host, ...q1 });
		for (let step = 1; step <= 55; step += 1) {
			scope.send("pie-content-loaded", { itemId: "q1", step });
		}

		provideRuntime(runtimeNode);
		expect(loaded.map((detail) => detail.step)).toEqual(
			Array.from({ length: 50 }, (_, index) => index + 6),
		);
	});

	test("drops what it holds when it disconnects or withdraws", () => {
		for (const end of ["disconnect", "withdraw"] as const) {
			const { runtimeNode, host, scope } = setup({ runtime: false });
			const loaded = received(runtimeNode, "pie-content-loaded");
			scope.publish({ host, ...q1 });
			scope.send("pie-content-loaded", { itemId: "q1" });
			if (end === "disconnect") scope.disconnect();
			else scope.publish(null);

			scope.publish({ host, ...q1 });
			provideRuntime(runtimeNode);
			expect(loaded).toEqual([]);
		}
	});

	test("answers no tool after it disconnects", () => {
		const { host, tool, scope } = setup();
		scope.publish({
			host,
			kind: "item",
			itemId: "q1",
			contentKind: "assessment-item",
		});
		scope.disconnect();
		expect(subscribe(tool, assessmentToolkitShellContext)).toEqual([]);
	});
});
