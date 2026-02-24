import { describe, expect, test } from "bun:test";
import {
	ContextConsumer,
	ContextProvider,
	ContextProviderEvent,
	ContextRequestEvent,
	ContextRoot,
	createContext,
	requestContext,
} from "../src/index.js";

describe("pie-context", () => {
	test("createContext preserves key identity", () => {
		const key = Symbol("runtime");
		const context = createContext<{ value: number }>(key);
		expect(context).toBe(key);
	});

	test("ContextRequestEvent defaults subscribe to false", () => {
		const runtimeContext = createContext<number>(Symbol("runtime-number"));
		const requester = new EventTarget() as unknown as Element;
		const request = new ContextRequestEvent(
			runtimeContext,
			requester,
			() => {},
		);
		expect(request.subscribe).toBe(false);
	});

	test("ContextProvider serves one-time requests", () => {
		const host = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<{ ready: boolean }>(Symbol("runtime"));
		const provider = new ContextProvider(host, {
			context: runtimeContext,
			initialValue: { ready: true },
		});
		provider.connect();

		let provided: { ready: boolean } | undefined;
		host.dispatchEvent(
			new ContextRequestEvent(
				runtimeContext,
				requester,
				(value) => {
					provided = value;
				},
				false,
			),
		);
		provider.setValue({ ready: false });

		expect(provided).toEqual({ ready: true });
		provider.disconnect();
	});

	test("ContextProvider notifies subscribers when value changes", () => {
		const host = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<number>(Symbol("runtime-number"));
		const provider = new ContextProvider(host, {
			context: runtimeContext,
			initialValue: 1,
		});
		provider.connect();

		const updates: number[] = [];
		host.dispatchEvent(
			new ContextRequestEvent(
				runtimeContext,
				requester,
				(value) => updates.push(value),
				true,
			),
		);
		provider.setValue(2);
		provider.setValue(3);

		expect(updates).toEqual([1, 2, 3]);
		provider.disconnect();
	});

	test("ContextProvider re-parents subscriptions to nested providers", () => {
		const host = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("runtime-string"));
		const provider = new ContextProvider(host, {
			context: runtimeContext,
			initialValue: "ancestor",
		});
		provider.connect();

		const seen: string[] = [];
		let activeUnsubscribe: (() => void) | undefined;
		host.dispatchEvent(
			new ContextRequestEvent(
				runtimeContext,
				requester,
				(value, unsubscribe) => {
					if (activeUnsubscribe !== unsubscribe) {
						activeUnsubscribe?.();
						activeUnsubscribe = unsubscribe;
					}
					seen.push(value);
				},
				true,
			),
		);

		let nestedProviderRequests = 0;
		requester.addEventListener("context-request", (event: Event) => {
			const request = event as ContextRequestEvent<typeof runtimeContext>;
			if (request.context !== runtimeContext || !request.subscribe) return;
			nestedProviderRequests += 1;
			request.callback("child-provider", () => {});
		});

		host.dispatchEvent(new ContextProviderEvent(runtimeContext, requester));
		provider.setValue("ancestor-after-reparent");

		expect(nestedProviderRequests).toBe(1);
		expect(seen).toEqual(["ancestor", "child-provider"]);
		provider.disconnect();
	});

	test("ContextConsumer requests values and subscribes", () => {
		const host = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("runtime-string"));
		const subscriptions = new Set<(value: string) => void>();
		host.addEventListener("context-request", (event: Event) => {
			const request = event as ContextRequestEvent<typeof runtimeContext>;
			if (request.context !== runtimeContext) return;
			if (request.subscribe) {
				const callback = (nextValue: string) => request.callback(nextValue);
				subscriptions.add(callback);
				request.callback("initial", () => subscriptions.delete(callback));
				return;
			}
			request.callback("initial");
		});

		const seen: string[] = [];
		const consumer = new ContextConsumer(host, {
			context: runtimeContext,
			subscribe: true,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();
		for (const callback of subscriptions) callback("updated");
		consumer.disconnect();

		expect(seen).toEqual(["initial", "updated"]);
	});

	test("ContextConsumer replaces unsubscribe handlers when provider changes", () => {
		const host = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("provider-switch"));
		let requestCount = 0;
		let unsubscribeA = 0;
		let unsubscribeB = 0;

		host.addEventListener("context-request", (event: Event) => {
			const request = event as ContextRequestEvent<typeof runtimeContext>;
			if (request.context !== runtimeContext || !request.subscribe) return;
			requestCount += 1;
			if (requestCount === 1) {
				request.callback("from-a", () => {
					unsubscribeA += 1;
				});
				return;
			}
			request.callback("from-b", () => {
				unsubscribeB += 1;
			});
		});

		const seen: string[] = [];
		const consumer = new ContextConsumer(host, {
			context: runtimeContext,
			subscribe: true,
			onValue: (value) => seen.push(value),
		});

		consumer.connect();
		consumer.requestValue();
		consumer.disconnect();

		expect(seen).toEqual(["from-a", "from-b"]);
		expect(unsubscribeA).toBe(1);
		expect(unsubscribeB).toBe(1);
	});

	test("ContextConsumer connect and disconnect are idempotent", () => {
		const host = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("idempotent-consumer"));
		let requestCount = 0;

		host.addEventListener("context-request", (event: Event) => {
			const request = event as ContextRequestEvent<typeof runtimeContext>;
			if (request.context !== runtimeContext) return;
			requestCount += 1;
			request.callback("value");
		});

		const consumer = new ContextConsumer(host, {
			context: runtimeContext,
			subscribe: false,
		});
		consumer.connect();
		consumer.connect();
		consumer.disconnect();
		consumer.disconnect();

		expect(requestCount).toBe(1);
		expect(consumer.value).toBe("value");
	});

	test("ContextProvider connect and disconnect are idempotent", () => {
		const host = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<number>(Symbol("idempotent-provider"));
		const provider = new ContextProvider(host, {
			context: runtimeContext,
			initialValue: 1,
		});

		const seen: number[] = [];
		provider.connect();
		provider.connect();
		host.dispatchEvent(
			new ContextRequestEvent(
				runtimeContext,
				requester,
				(value) => seen.push(value),
				true,
			),
		);
		provider.setValue(2);
		provider.disconnect();
		provider.disconnect();

		expect(seen).toEqual([1, 2]);
	});

	test("requestContext performs one-time lookup", () => {
		const host = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<number>(Symbol("lookup"));
		host.addEventListener("context-request", (event: Event) => {
			const request = event as ContextRequestEvent<typeof runtimeContext>;
			if (request.context === runtimeContext) {
				request.callback(42);
			}
		});

		expect(requestContext(host, runtimeContext)).toBe(42);
	});

	test("ContextRoot replays pending requests on provider announcement", () => {
		const rootHost = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("delayed"));
		const contextRoot = new ContextRoot(rootHost);
		contextRoot.attach();

		let replayed = 0;
		requester.addEventListener("context-request", () => {
			replayed += 1;
		});

		const callback = () => {};
		rootHost.dispatchEvent(
			new ContextRequestEvent(runtimeContext, requester, callback, true),
		);
		rootHost.dispatchEvent(
			new ContextRequestEvent(runtimeContext, requester, callback, true),
		);
		rootHost.dispatchEvent(new ContextProviderEvent(runtimeContext, rootHost));
		contextRoot.detach();

		expect(replayed).toBe(1);
	});

	test("ContextRoot attach and detach are idempotent", () => {
		const rootHost = new EventTarget() as unknown as Element;
		const requester = new EventTarget() as unknown as Element;
		const runtimeContext = createContext<string>(Symbol("root-idempotent"));
		const contextRoot = new ContextRoot(rootHost);

		contextRoot.attach();
		contextRoot.attach();

		let replayed = 0;
		requester.addEventListener("context-request", () => {
			replayed += 1;
		});
		rootHost.dispatchEvent(
			new ContextRequestEvent(runtimeContext, requester, () => {}, true),
		);
		rootHost.dispatchEvent(new ContextProviderEvent(runtimeContext, rootHost));

		contextRoot.detach();
		contextRoot.detach();
		rootHost.dispatchEvent(
			new ContextRequestEvent(runtimeContext, requester, () => {}, true),
		);
		rootHost.dispatchEvent(new ContextProviderEvent(runtimeContext, rootHost));

		expect(replayed).toBe(1);
	});
});
