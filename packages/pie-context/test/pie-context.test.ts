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

		rootHost.dispatchEvent(
			new ContextRequestEvent(runtimeContext, requester, () => {}, true),
		);
		rootHost.dispatchEvent(new ContextProviderEvent(runtimeContext, rootHost));
		contextRoot.detach();

		expect(replayed).toBe(1);
	});
});
