import { ContextRequestEvent } from "./events.js";
import type { UnknownContext } from "./types.js";

type ContextCallback = (value: unknown, unsubscribe?: () => void) => void;

interface PendingRequest {
	requestorRef: WeakRef<Element>;
	callbackRef: WeakRef<ContextCallback>;
}

interface PendingContext {
	callbacks: WeakMap<Element, WeakSet<ContextCallback>>;
	requests: PendingRequest[];
}

/**
 * The fields a `context-request` carries, read by shape: another copy of this
 * package, or Lit's context protocol, may have created the event.
 */
type RequestShape = {
	context?: unknown;
	contextTarget?: Element;
	callback?: unknown;
	subscribe?: unknown;
};

const getLivePending = (pending: PendingRequest[]) => {
	const requests: PendingRequest[] = [];
	for (const entry of pending) {
		if (entry.requestorRef.deref() && entry.callbackRef.deref()) {
			requests.push(entry);
		}
	}
	return requests;
};

/**
 * Records the subscribing requests that reach its host unanswered, and replays
 * them when a provider for their context announces itself. It never stops
 * propagation, so Lit's root, which listens for the same event names, still
 * sees both events.
 */
export class ContextRoot {
	private readonly host: Element;
	private readonly pendingByContext = new Map<unknown, PendingContext>();
	private attached = false;

	public constructor(host: Element) {
		this.host = host;
	}

	public attach(): void {
		if (this.attached) return;
		this.attached = true;
		this.host.addEventListener("context-request", this.onContextRequest);
		this.host.addEventListener("context-provider", this.onContextProvider);
	}

	public detach(): void {
		if (!this.attached) return;
		this.attached = false;
		this.host.removeEventListener("context-request", this.onContextRequest);
		this.host.removeEventListener("context-provider", this.onContextProvider);
		this.pendingByContext.clear();
	}

	private readonly onContextRequest = (event: Event) => {
		// A provider stops propagation of a request it answers, which keeps the
		// request from ancestors but not from a later listener on its own element.
		if (event.cancelBubble) return;
		const request = event as Event & RequestShape;
		if (request.subscribe !== true) return;
		if (typeof request.callback !== "function") return;
		if (request.context === undefined) return;
		const requestor =
			request.contextTarget ??
			(event.composedPath?.()[0] as Element | undefined);
		if (!requestor) return;

		let pending = this.pendingByContext.get(request.context);
		if (!pending) {
			pending = {
				callbacks: new WeakMap<Element, WeakSet<ContextCallback>>(),
				requests: [],
			};
			this.pendingByContext.set(request.context, pending);
		}

		const callback = request.callback as ContextCallback;
		let seenForRequestor = pending.callbacks.get(requestor);
		if (!seenForRequestor) {
			seenForRequestor = new WeakSet<ContextCallback>();
			pending.callbacks.set(requestor, seenForRequestor);
		}
		if (seenForRequestor.has(callback)) return;

		seenForRequestor.add(callback);
		pending.requests.push({
			requestorRef: new WeakRef(requestor),
			callbackRef: new WeakRef(callback),
		});
		pending.requests = getLivePending(pending.requests);
	};

	private readonly onContextProvider = (event: Event) => {
		const context = (event as Event & { context?: unknown }).context;
		if (context === undefined) return;
		const pending = this.pendingByContext.get(context);
		if (!pending || pending.requests.length === 0) return;

		// A replayed request that finds no provider arrives here again and is
		// recorded afresh.
		this.pendingByContext.delete(context);
		for (const entry of pending.requests) {
			const requestor = entry.requestorRef.deref();
			const callback = entry.callbackRef.deref();
			if (!requestor || !callback) continue;
			requestor.dispatchEvent(
				new ContextRequestEvent(
					context as UnknownContext,
					requestor,
					callback,
					true,
				),
			);
		}
	};
}

const DOCUMENT_ROOT_SLOT = Symbol.for("pie.context.documentRoot");

/**
 * Installs one {@link ContextRoot} per Document, on its `documentElement`, so a
 * subscription made before its provider connects is answered when the provider
 * announces itself. The root lives in a `Symbol.for` slot on the document: a
 * page loads several copies of this package, and the first to get here installs
 * the root for all of them. Does nothing without a document element. An iframe's
 * document gets its own root.
 *
 * `ContextConsumer.connect` calls this for a subscribing consumer, through its
 * host's `ownerDocument`, before its first request.
 */
export function ensureDocumentContextRoot(
	doc: Document | null | undefined,
): void {
	if (!doc) return;
	const slots = doc as unknown as Record<symbol, unknown>;
	if (slots[DOCUMENT_ROOT_SLOT]) return;
	const element = doc.documentElement;
	if (!element) return;
	const root = new ContextRoot(element);
	root.attach();
	slots[DOCUMENT_ROOT_SLOT] = root;
}
