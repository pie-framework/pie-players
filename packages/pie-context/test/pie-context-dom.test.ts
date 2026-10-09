import { RuntimeEvent } from "./setup-dom.js";
import { describe, expect, test } from "bun:test";
import {
	ContextConsumer,
	ContextProvider,
	ContextRequestEvent,
	ContextRoot,
	connectContextWithRetry,
	createContext,
	ensureDocumentContextRoot,
} from "../src/index.js";

const DOCUMENT_ROOT_SLOT = Symbol.for("pie.context.documentRoot");

const newDocument = () => document.implementation.createHTMLDocument("test");

const slotOf = (doc: Document) =>
	(doc as unknown as Record<symbol, unknown>)[DOCUMENT_ROOT_SLOT];

/** Counts the `context-request` events `host` dispatches itself. */
const countRequestsFrom = (host: Element) => {
	const counter = { requests: 0 };
	host.addEventListener("context-request", (event) => {
		if (event.target === host) counter.requests += 1;
	});
	return counter;
};

/** `<div data-provider><span data-consumer>` in `doc`'s body. */
const providerAndConsumer = (doc: Document) => {
	const providerHost = doc.createElement("div");
	const consumerHost = doc.createElement("span");
	providerHost.append(consumerHost);
	doc.body.append(providerHost);
	return { providerHost, consumerHost };
};

describe("pie-context in a document tree", () => {
	test("a subscribing consumer installs the document root before its first request", () => {
		const doc = newDocument();
		const { consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.install"));
		expect(slotOf(doc)).toBeUndefined();

		const oneShot = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			subscribe: false,
		});
		oneShot.connect();
		expect(slotOf(doc)).toBeUndefined();

		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
		});
		consumer.connect();
		expect(slotOf(doc)).toBeInstanceOf(ContextRoot);
		consumer.disconnect();
	});

	test("a provider that connects late answers through the document root", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.late"));
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();
		expect(seen).toEqual([]);

		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		provider.setValue("second");

		expect(seen).toEqual(["first", "second"]);
		consumer.disconnect();
		provider.disconnect();
	});

	test("a consumer inside a shadow root finds a late provider outside it", () => {
		const doc = newDocument();
		const providerHost = doc.createElement("section");
		const shadowHost = doc.createElement("div");
		providerHost.append(shadowHost);
		doc.body.append(providerHost);
		const shadow = shadowHost.attachShadow({ mode: "open" });
		const consumerHost = doc.createElement("span");
		shadow.append(consumerHost);
		const runtimeContext = createContext<string>(Symbol.for("test.shadow"));

		const seen: string[] = [];
		const cleanup = connectContextWithRetry(
			consumerHost,
			runtimeContext,
			(value) => seen.push(value),
		);
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "through-shadow",
		});
		provider.connect();

		expect(seen).toEqual(["through-shadow"]);
		cleanup();
		provider.disconnect();
	});

	test("one root serves the document when another copy installed it first", () => {
		const doc = newDocument();
		const otherCopyRoot = new ContextRoot(doc.documentElement);
		otherCopyRoot.attach();
		(doc as unknown as Record<symbol, unknown>)[DOCUMENT_ROOT_SLOT] =
			otherCopyRoot;

		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.copies"));
		const requests = countRequestsFrom(consumerHost);
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
		});
		consumer.connect();
		ensureDocumentContextRoot(doc);
		expect(slotOf(doc)).toBe(otherCopyRoot);

		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "value",
		});
		provider.connect();

		// The first request plus one replay: a second root would replay again.
		expect(requests.requests).toBe(2);
		expect(consumer.value).toBe("value");
		consumer.disconnect();
		provider.disconnect();
		otherCopyRoot.detach();
	});

	test("a request a provider answered is not replayed", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.answered"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "value",
		});
		provider.connect();
		const requests = countRequestsFrom(consumerHost);
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
		});
		consumer.connect();

		const elsewhere = doc.createElement("aside");
		doc.body.append(elsewhere);
		const otherProvider = new ContextProvider(elsewhere, {
			context: runtimeContext,
			initialValue: "other",
		});
		otherProvider.connect();

		expect(requests.requests).toBe(1);
		expect(consumer.value).toBe("value");
		consumer.disconnect();
		provider.disconnect();
		otherProvider.disconnect();
	});

	test("a request answered on the document element itself is not recorded", () => {
		const doc = newDocument();
		const consumerHost = doc.createElement("span");
		doc.body.append(consumerHost);
		const runtimeContext = createContext<string>(Symbol.for("test.top"));
		const provider = new ContextProvider(doc.documentElement, {
			context: runtimeContext,
			initialValue: "top",
		});
		provider.connect();
		const requests = countRequestsFrom(consumerHost);
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
		});
		consumer.connect();

		const elsewhere = doc.createElement("aside");
		doc.body.append(elsewhere);
		const otherProvider = new ContextProvider(elsewhere, {
			context: runtimeContext,
			initialValue: "other",
		});
		otherProvider.connect();

		// The top provider hands its subscription to the new provider once; a
		// request the root had recorded would be replayed as well.
		expect(requests.requests).toBe(2);
		expect(consumer.value).toBe("top");
		consumer.disconnect();
		provider.disconnect();
		otherProvider.disconnect();
	});

	test("updates still reach a consumer after its provider answers it again", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.reanswer"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();

		consumer.requestValue();
		provider.setValue("second");

		expect(seen).toEqual(["first", "first", "second"]);
		consumer.disconnect();
		provider.disconnect();
	});

	test("updates still reach a consumer after a nested provider elsewhere connects", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.nested"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();

		// The outer provider hands its subscriptions to the new provider, which
		// does not contain the consumer, so the outer one answers it again.
		const sibling = doc.createElement("div");
		providerHost.append(sibling);
		const nested = new ContextProvider(sibling, {
			context: runtimeContext,
			initialValue: "nested",
		});
		nested.connect();
		provider.setValue("second");

		expect(seen).toEqual(["first", "first", "second"]);
		consumer.disconnect();
		provider.disconnect();
		nested.disconnect();
	});

	test("a consumer whose provider disconnects is answered by the nearest provider left", () => {
		const doc = newDocument();
		const outerHost = doc.createElement("section");
		doc.body.append(outerHost);
		const providerHost = doc.createElement("div");
		const consumerHost = doc.createElement("span");
		providerHost.append(consumerHost);
		outerHost.append(providerHost);
		const runtimeContext = createContext<string>(Symbol.for("test.handback"));
		const outer = new ContextProvider(outerHost, {
			context: runtimeContext,
			initialValue: "outer",
		});
		outer.connect();
		const inner = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "inner",
		});
		inner.connect();
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();

		inner.disconnect();
		outer.setValue("outer-2");

		expect(seen).toEqual(["inner", "outer", "outer-2"]);
		consumer.disconnect();
		outer.disconnect();
	});

	test("a provider that reconnects in place answers its consumers again", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.reconnect"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();

		provider.disconnect();
		provider.connect();
		provider.setValue("second");

		expect(seen).toEqual(["first", "first", "second"]);
		consumer.disconnect();
		provider.disconnect();
	});

	test("a provider moved with its consumers keeps them", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const destination = doc.createElement("aside");
		doc.body.append(destination);
		const runtimeContext = createContext<string>(Symbol.for("test.moved"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();

		// A custom element's callbacks on a move: disconnected while out of the
		// document, connected once inserted.
		providerHost.remove();
		provider.disconnect();
		destination.append(providerHost);
		provider.connect();
		provider.setValue("second");

		expect(seen).toEqual(["first", "first", "second"]);
		consumer.disconnect();
		provider.disconnect();
	});

	test("a consumer that disconnected before its provider connected ignores the replay", () => {
		const doc = newDocument();
		const { providerHost, consumerHost } = providerAndConsumer(doc);
		const runtimeContext = createContext<string>(Symbol.for("test.gone"));
		const seen: string[] = [];
		const consumer = new ContextConsumer(consumerHost, {
			context: runtimeContext,
			onValue: (value) => seen.push(value),
		});
		consumer.connect();
		consumer.disconnect();

		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "first",
		});
		provider.connect();
		provider.setValue("second");

		expect(seen).toEqual([]);
		expect(consumer.value).toBeUndefined();
		provider.disconnect();
	});

	test("a copy loaded before the DOM registered dispatches its events on it", async () => {
		// A bundle evaluated while the global `Event` was still the runtime's.
		const domEvent = globalThis.Event;
		expect(RuntimeEvent).not.toBe(domEvent);
		const specifier = "../src/events.ts?copy-under-runtime-event";
		globalThis.Event = RuntimeEvent;
		let copy: typeof import("../src/events.js");
		try {
			copy = await import(specifier);
		} finally {
			globalThis.Event = domEvent;
		}
		expect(copy.ContextRequestEvent).not.toBe(ContextRequestEvent);

		const providerHost = document.createElement("div");
		const consumerHost = document.createElement("span");
		providerHost.append(consumerHost);
		document.body.append(providerHost);
		const runtimeContext = createContext<string>(Symbol.for("test.realm"));
		const provider = new ContextProvider(providerHost, {
			context: runtimeContext,
			initialValue: "value",
		});
		provider.connect();

		const seen: string[] = [];
		const request = new copy.ContextRequestEvent(
			runtimeContext,
			consumerHost,
			(value) => seen.push(value),
		);
		consumerHost.dispatchEvent(request);
		const announcement = new copy.ContextProviderEvent(
			runtimeContext,
			providerHost,
		);
		providerHost.dispatchEvent(announcement);

		// This copy's provider matches the other copy's request by its key alone.
		expect(seen).toEqual(["value"]);
		expect(request).toBeInstanceOf(copy.ContextRequestEvent);
		expect(request).not.toBeInstanceOf(ContextRequestEvent);
		expect(announcement).toBeInstanceOf(copy.ContextProviderEvent);
		provider.disconnect();
		providerHost.remove();
	});

	test("each document gets its own root", () => {
		const first = newDocument();
		const second = newDocument();
		ensureDocumentContextRoot(first);
		ensureDocumentContextRoot(second);
		ensureDocumentContextRoot(first);

		expect(slotOf(first)).toBeInstanceOf(ContextRoot);
		expect(slotOf(second)).toBeInstanceOf(ContextRoot);
		expect(slotOf(first)).not.toBe(slotOf(second));
	});

	test("ensureDocumentContextRoot does nothing without a document element", () => {
		const detached = {} as Document;
		expect(() => ensureDocumentContextRoot(null)).not.toThrow();
		expect(() => ensureDocumentContextRoot(undefined)).not.toThrow();
		ensureDocumentContextRoot(detached);
		expect(slotOf(detached)).toBeUndefined();

		const host = new EventTarget() as unknown as Element;
		const consumer = new ContextConsumer(host, {
			context: createContext<string>(Symbol.for("test.no-document")),
		});
		expect(() => consumer.connect()).not.toThrow();
		consumer.disconnect();
	});
});
