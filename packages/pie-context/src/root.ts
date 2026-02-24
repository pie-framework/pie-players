import {
	ContextProviderEvent,
	ContextRequestEvent,
} from "./events.js";
import type { UnknownContext } from "./types.js";

interface PendingRequest {
	requestorRef: WeakRef<Element>;
	callbackRef: WeakRef<(
		value: unknown,
		unsubscribe?: () => void,
	) => void>;
}

const getLivePending = (pending: PendingRequest[]) =>
	pending.filter((entry) => entry.requestorRef.deref() && entry.callbackRef.deref());

export class ContextRoot {
	private readonly host: Element;
	private readonly pendingByContext = new Map<UnknownContext, PendingRequest[]>();
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

		const pending = this.pendingByContext.get(event.context) ?? [];
		const requestorRef = new WeakRef(event.contextTarget);
		const callbackRef = new WeakRef(event.callback);

		pending.push({ requestorRef, callbackRef });
		this.pendingByContext.set(event.context, getLivePending(pending));
	};

	private readonly onContextProvider = (event: ContextProviderEvent) => {
		const pending = this.pendingByContext.get(event.context);
		if (!pending || pending.length === 0) return;

		this.pendingByContext.delete(event.context);
		for (const entry of pending) {
			const requestor = entry.requestorRef.deref();
			const callback = entry.callbackRef.deref();
			if (!requestor || !callback) continue;
			requestor.dispatchEvent(
				new ContextRequestEvent(event.context, requestor, callback, true),
			);
		}
	};
}
