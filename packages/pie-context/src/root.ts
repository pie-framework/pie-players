import {
	ContextProviderEvent,
	ContextRequestEvent,
} from "./events.js";
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

const getLivePending = (pending: PendingRequest[]) => {
	const requests: PendingRequest[] = [];
	for (const entry of pending) {
		if (entry.requestorRef.deref() && entry.callbackRef.deref()) {
			requests.push(entry);
		}
	}
	return requests;
};

export class ContextRoot {
	private readonly host: Element;
	private readonly pendingByContext = new Map<UnknownContext, PendingContext>();
	private attached = false;

	public constructor(host: Element) {
		this.host = host;
	}

	public attach(): void {
		if (this.attached) return;
		this.attached = true;
		this.host.addEventListener(
			"context-request",
			this.onContextRequest as EventListener,
		);
		this.host.addEventListener(
			"context-provider",
			this.onContextProvider as EventListener,
		);
	}

	public detach(): void {
		if (!this.attached) return;
		this.attached = false;
		this.host.removeEventListener(
			"context-request",
			this.onContextRequest as EventListener,
		);
		this.host.removeEventListener(
			"context-provider",
			this.onContextProvider as EventListener,
		);
		this.pendingByContext.clear();
	}

	private readonly onContextRequest = (event: ContextRequestEvent) => {
		if (!event.subscribe) return;

		let pending = this.pendingByContext.get(event.context);
		if (!pending) {
			pending = {
				callbacks: new WeakMap<Element, WeakSet<ContextCallback>>(),
				requests: [],
			};
			this.pendingByContext.set(event.context, pending);
		}

		const requestor = event.contextTarget;
		const callback = event.callback as ContextCallback;
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

	private readonly onContextProvider = (event: ContextProviderEvent) => {
		const pending = this.pendingByContext.get(event.context);
		if (!pending || pending.requests.length === 0) return;

		this.pendingByContext.delete(event.context);
		for (const entry of pending.requests) {
			const requestor = entry.requestorRef.deref();
			const callback = entry.callbackRef.deref();
			if (!requestor || !callback) continue;
			requestor.dispatchEvent(
				new ContextRequestEvent(event.context, requestor, callback, true),
			);
		}
	};
}
