/**
 * The harness uses raw `EventTarget` hosts, as
 * `runtime/section-runtime-engine-host-context.test.ts` does: happy-dom's
 * `dispatchEvent` rejects pie-context's events whenever another file loaded
 * pie-context first, its classes extending the `Event` of that moment. With no
 * tree to bubble through, a request a tool or the shell would send up arrives
 * at the shell host directly, and a runtime above the shell is a stub on the
 * host that answers the shell's own request.
 */
import { afterEach, describe, expect, test } from "bun:test";
import {
	ContextProviderEvent,
	ContextRequestEvent,
} from "@pie-players/pie-context";
import type { AccessibilityCatalog } from "@pie-players/pie-players-shared/types";
import {
	assessmentToolkitHostRuntimeContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitShellContext,
} from "../src/context/assessment-toolkit-context.js";
import {
	PIE_REGISTER_EVENT,
	PIE_UNREGISTER_EVENT,
} from "../src/runtime/registration-events.js";
import { createShellScope } from "../src/runtime/shell-scope.js";

class FakeElement extends EventTarget {
	readonly #attributes = new Map<string, string>();
	getAttribute(name: string): string | null {
		return this.#attributes.get(name) ?? null;
	}
	setAttribute(name: string, value: string): void {
		this.#attributes.set(name, String(value));
	}
}

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

/** A toolkit above `host`, answering the host's request for its runtime. */
const provideRuntime = (host: FakeElement) => {
	const answer = (event: Event) => {
		const request = event as ContextRequestEvent<
			typeof assessmentToolkitHostRuntimeContext
		>;
		if (request.context !== assessmentToolkitHostRuntimeContext) return;
		request.stopPropagation();
		request.callback({ runtimeId: "runtime-1", coordinator: {} } as never);
	};
	host.addEventListener("context-request", answer);
	host.dispatchEvent(
		new ContextProviderEvent(
			assessmentToolkitHostRuntimeContext,
			host as unknown as Element,
		),
	);
	runtimes.push(() => host.removeEventListener("context-request", answer));
};

/**
 * A shell host inside a runtime unless `runtime` is false, a tool and a region
 * inside it, and the registrations the host dispatches.
 */
const setup = ({ runtime = true } = {}) => {
	const fake = new FakeElement();
	const host = fake as unknown as HTMLElement;
	const tool = new FakeElement() as unknown as HTMLElement;
	const content = new FakeElement() as unknown as HTMLElement;
	if (runtime) provideRuntime(fake);
	const registrations: Array<{ type: string; itemId: string; item: unknown }> =
		[];
	for (const type of [PIE_REGISTER_EVENT, PIE_UNREGISTER_EVENT]) {
		host.addEventListener(type, (event) => {
			const detail = (event as CustomEvent).detail;
			registrations.push({ type, itemId: detail.itemId, item: detail.item });
		});
	}
	const scope = createShellScope();
	scopes.push(scope);
	return { fake, host, tool, content, registrations, scope };
};

/** Every value `tool` is given for `context`, as a subscribed tool sees them. */
const subscribe = <T>(
	host: HTMLElement,
	tool: HTMLElement,
	context: unknown,
): T[] => {
	const values: T[] = [];
	host.dispatchEvent(
		new ContextRequestEvent(
			context as never,
			tool,
			(value: unknown) => values.push(value as T),
			true,
		),
	);
	return values;
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
		}>(host, tool, assessmentToolkitShellContext);
		const [region] = subscribe<{ scopeElement: HTMLElement }>(
			host,
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
			{ type: PIE_REGISTER_EVENT, itemId: "q1", item: first },
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
			host,
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
		const shells = subscribe(host, tool, assessmentToolkitShellContext);

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
		});
	});

	test("registers nothing without an item id, and retires under the identity it registered", () => {
		const { host, registrations, scope } = setup();
		const state = { host, kind: "item" as const, contentKind: "assessment-item" };
		scope.publish({ ...state, itemId: "" });
		expect(registrations).toEqual([]);

		scope.publish({ ...state, itemId: "q1" });
		scope.retire();
		expect(registrations.map(({ type, itemId }) => [type, itemId])).toEqual([
			[PIE_REGISTER_EVENT, "q1"],
			[PIE_UNREGISTER_EVENT, "q1"],
		]);
	});

	test("registers once the runtime it sits in answers", () => {
		const { fake, host, registrations, scope } = setup({ runtime: false });
		scope.publish({
			host,
			kind: "item",
			itemId: "q1",
			contentKind: "assessment-item",
		});
		expect(registrations).toEqual([]);

		provideRuntime(fake);
		expect(registrations.map(({ type, itemId }) => [type, itemId])).toEqual([
			[PIE_REGISTER_EVENT, "q1"],
		]);
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
		expect(subscribe(host, tool, assessmentToolkitShellContext)).toEqual([]);
	});
});
