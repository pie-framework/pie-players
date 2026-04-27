/**
 * Cross-CE engine context bridge tests (M7 PR 6).
 *
 * The wrapped toolkit reaches the kernel's `SectionRuntimeEngine`
 * across the toolkit's shadow boundary through a `pie-context` based
 * handshake on the layout CE host. This file pins the helper's own
 * wiring on a single raw `EventTarget` host:
 *
 *   - **Wrapped path.** When a provider on the host answers
 *     `context-request` with an engine value, the helper's
 *     `onValue` listener fires synchronously on connect.
 *   - **Standalone path.** When no provider answers, the helper
 *     stays unresolved (the retry interval bounds the wait at ~10 s;
 *     this test asserts no synchronous fire and tears down well
 *     before that bound).
 *   - **Late provider attach.** A consumer that connects before any
 *     provider attaches still resolves once a `context-provider`
 *     announcement is dispatched on the host, exercising the
 *     `context-provider` re-request path.
 *   - **Resubscribe.** A subscriber that is re-fed a new value via
 *     the existing subscription callback receives every emission.
 *   - **Cleanup.** The disconnect callback removes the listener and
 *     clears the retry interval (no late callbacks after teardown).
 *
 * The cross-CE bubbling path itself (consumer host → ancestor
 * provider host) is owned by `@pie-players/pie-context`'s own test
 * suite (`packages/pie-context/test/pie-context.test.ts`) and the
 * end-to-end wrapped/standalone toolkit suites; this file does not
 * re-test that mechanism.
 *
 * The harness uses raw `EventTarget` instances rather than happy-dom
 * elements: happy-dom's `dispatchEvent` rejects custom `Event`
 * subclasses whose realm-bound `Event` differs from happy-dom's
 * (pie-context bundles its own event classes resolved at module
 * load), and the existing `pie-context` test suite uses the same
 * `EventTarget`-as-Element pattern.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
	ContextProviderEvent,
	ContextRequestEvent,
} from "@pie-players/pie-context";

import { SectionRuntimeEngine } from "../../src/runtime/SectionRuntimeEngine.js";
import {
	connectSectionRuntimeEngineHostContext,
	sectionRuntimeEngineHostContext,
	type SectionRuntimeEngineHostContextValue,
} from "../../src/runtime/section-runtime-engine-host-context.js";

interface FakeProvider {
	setValue: (value: SectionRuntimeEngineHostContextValue) => void;
	announce: () => void;
	disconnect: () => void;
}

// Hand-rolled provider stub that lives on the same host as the
// consumer. The real `ContextProvider` (in
// `@pie-players/pie-context/dist/provider.js`) deliberately
// short-circuits when `event.contextTarget === this.host` (a
// provider does not answer requests originating from its own host)
// — and the `connectSectionRuntimeEngineHostContext` helper passes
// the host as the `contextTarget`. Real DOM solves this by placing
// the provider on an ancestor element and relying on bubbling /
// composedPath; a unit test on a single raw `EventTarget` cannot
// simulate bubbling without a tree, so the stub answers the
// consumer's request directly. This keeps the test focused on the
// helper's own wiring (initial fire, retry on `context-provider`,
// late attach, cleanup) — the bubbling path is owned by
// `pie-context`'s own test suite.
function makeFakeProvider(
	host: HTMLElement,
	initialValue: SectionRuntimeEngineHostContextValue,
): FakeProvider {
	let currentValue = initialValue;
	const subscriptions: Array<{
		callback: (
			value: SectionRuntimeEngineHostContextValue,
			unsubscribe?: () => void,
		) => void;
		unsubscribe: () => void;
	}> = [];

	const onRequest = (event: Event) => {
		const request = event as ContextRequestEvent<
			typeof sectionRuntimeEngineHostContext
		>;
		if (request.context !== sectionRuntimeEngineHostContext) return;
		event.stopPropagation();
		if (!request.subscribe) {
			request.callback(currentValue);
			return;
		}
		const unsubscribe = () => {
			const index = subscriptions.findIndex(
				(s) => s.callback === request.callback,
			);
			if (index >= 0) subscriptions.splice(index, 1);
		};
		subscriptions.push({ callback: request.callback, unsubscribe });
		request.callback(currentValue, unsubscribe);
	};
	host.addEventListener("context-request", onRequest);

	return {
		setValue(next) {
			currentValue = next;
			for (const subscription of subscriptions) {
				subscription.callback(currentValue, subscription.unsubscribe);
			}
		},
		announce() {
			host.dispatchEvent(
				new ContextProviderEvent(sectionRuntimeEngineHostContext, host),
			);
		},
		disconnect() {
			host.removeEventListener("context-request", onRequest);
			subscriptions.length = 0;
		},
	};
}

function makeHost(): HTMLElement {
	return new EventTarget() as unknown as HTMLElement;
}

interface Harness {
	host: HTMLElement;
	cleanups: Array<() => void>;
}

function makeHarness(): Harness {
	return { host: makeHost(), cleanups: [] };
}

function disposeHarness(harness: Harness): void {
	for (const cleanup of harness.cleanups.splice(0)) {
		try {
			cleanup();
		} catch {
			// best-effort
		}
	}
}

describe("connectSectionRuntimeEngineHostContext", () => {
	let harness: Harness;

	beforeEach(() => {
		harness = makeHarness();
	});

	afterEach(() => {
		disposeHarness(harness);
	});

	test("wrapped: consumer resolves to the provider's engine on connect", () => {
		const engine = new SectionRuntimeEngine();
		const provider = makeFakeProvider(harness.host, { engine });
		harness.cleanups.push(() => provider.disconnect());

		const received: SectionRuntimeEngineHostContextValue[] = [];
		const detach = connectSectionRuntimeEngineHostContext(
			harness.host,
			(value) => {
				received.push(value);
			},
		);
		harness.cleanups.push(detach);

		expect(received.length).toBeGreaterThanOrEqual(1);
		expect(received[0]?.engine).toBe(engine);
	});

	test("standalone: consumer stays unresolved when no provider responds", () => {
		const received: SectionRuntimeEngineHostContextValue[] = [];
		const detach = connectSectionRuntimeEngineHostContext(
			harness.host,
			(value) => {
				received.push(value);
			},
		);
		harness.cleanups.push(detach);

		expect(received).toEqual([]);
	});

	test("late attach: provider that announces after consumer connects still resolves it", () => {
		const received: SectionRuntimeEngineHostContextValue[] = [];
		const detach = connectSectionRuntimeEngineHostContext(
			harness.host,
			(value) => {
				received.push(value);
			},
		);
		harness.cleanups.push(detach);

		expect(received).toEqual([]);

		const engine = new SectionRuntimeEngine();
		const provider = makeFakeProvider(harness.host, { engine });
		harness.cleanups.push(() => provider.disconnect());
		// The helper listens for `context-provider` announcements and
		// re-runs `requestValue()` when it sees one. We dispatch one
		// manually to mirror what `ContextProvider.connect()` does on a
		// real DOM host.
		provider.announce();

		expect(received.length).toBeGreaterThanOrEqual(1);
		expect(received[0]?.engine).toBe(engine);
	});

	test("subscribe: provider emits new engine value through the existing subscription", () => {
		const engineA = new SectionRuntimeEngine();
		const engineB = new SectionRuntimeEngine();
		const provider = makeFakeProvider(harness.host, { engine: engineA });
		harness.cleanups.push(() => provider.disconnect());

		const received: SectionRuntimeEngineHostContextValue[] = [];
		const detach = connectSectionRuntimeEngineHostContext(
			harness.host,
			(value) => {
				received.push(value);
			},
		);
		harness.cleanups.push(detach);

		expect(received[0]?.engine).toBe(engineA);
		provider.setValue({ engine: engineB });
		expect(received[received.length - 1]?.engine).toBe(engineB);
	});

	test("cleanup: disconnect removes the listener and stops further deliveries", () => {
		const engineA = new SectionRuntimeEngine();
		const engineB = new SectionRuntimeEngine();
		const provider = makeFakeProvider(harness.host, { engine: engineA });
		harness.cleanups.push(() => provider.disconnect());

		const received: SectionRuntimeEngineHostContextValue[] = [];
		const detach = connectSectionRuntimeEngineHostContext(
			harness.host,
			(value) => {
				received.push(value);
			},
		);
		expect(received[0]?.engine).toBe(engineA);
		const initialCount = received.length;

		detach();
		provider.setValue({ engine: engineB });

		expect(received.length).toBe(initialCount);
	});
});
