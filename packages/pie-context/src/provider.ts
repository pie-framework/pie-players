import { ContextProviderEvent, ContextRequestEvent } from "./events.js";
import type { ContextType, UnknownContext } from "./types.js";

interface Subscription<ValueType> {
	consumerHost: Element;
	callback: (value: ValueType, unsubscribe?: () => void) => void;
	readonly unsubscribe: () => void;
}

export interface ContextProviderOptions<T extends UnknownContext> {
	context: T;
	initialValue: ContextType<T>;
}

export class ContextProvider<T extends UnknownContext> {
	private readonly host: Element;
	private readonly context: T;
	private currentValue: ContextType<T>;
	private readonly subscriptions = new Map<
		(value: ContextType<T>, unsubscribe?: () => void) => void,
		Subscription<ContextType<T>>
	>();
	private isConnected = false;

	public constructor(host: Element, options: ContextProviderOptions<T>) {
		this.host = host;
		this.context = options.context;
		this.currentValue = options.initialValue;
	}

	public connect(): void {
		if (this.isConnected) return;
		this.isConnected = true;
		this.host.addEventListener(
			"context-request",
			this.handleContextRequest as EventListener,
		);
		this.host.addEventListener(
			"context-provider",
			this.handleContextProvider as EventListener,
		);
		this.host.dispatchEvent(new ContextProviderEvent(this.context, this.host));
	}

	public disconnect(): void {
		if (!this.isConnected) return;
		this.isConnected = false;
		this.host.removeEventListener(
			"context-request",
			this.handleContextRequest as EventListener,
		);
		this.host.removeEventListener(
			"context-provider",
			this.handleContextProvider as EventListener,
		);
		this.subscriptions.clear();
	}

	public setValue(value: ContextType<T>, force = false): void {
		if (!force && Object.is(this.currentValue, value)) return;
		this.currentValue = value;
		this.notifySubscribers();
	}

	public get value(): ContextType<T> {
		return this.currentValue;
	}

	private getContextTarget(event: Event, fallback: Element): Element {
		if ("contextTarget" in event && event.contextTarget) {
			return event.contextTarget as Element;
		}
		const path =
			typeof event.composedPath === "function" ? event.composedPath() : [];
		const firstPathTarget = path[0];
		return firstPathTarget ? (firstPathTarget as Element) : fallback;
	}

	private readonly handleContextRequest = (event: ContextRequestEvent) => {
		if (event.context !== this.context) return;
		const consumerHost = this.getContextTarget(event, this.host);
		if (consumerHost === this.host) return;

		// Closest provider wins for this context key.
		event.stopPropagation();

		if (!event.subscribe) {
			event.callback(this.currentValue);
			return;
		}

		// A callback answered again keeps its disposer. A consumer releases the
		// disposer it held when it is handed a different one, so a new disposer
		// here would have it release the subscription it was just given.
		const callback = event.callback;
		let subscription = this.subscriptions.get(callback);
		if (subscription) {
			subscription.consumerHost = consumerHost;
		} else {
			const entry: Subscription<ContextType<T>> = {
				consumerHost,
				callback,
				unsubscribe: () => {
					if (this.subscriptions.get(callback) === entry) {
						this.subscriptions.delete(callback);
					}
				},
			};
			this.subscriptions.set(callback, entry);
			subscription = entry;
		}
		callback(this.currentValue, subscription.unsubscribe);
	};

	private readonly handleContextProvider = (event: ContextProviderEvent) => {
		if (event.context !== this.context) return;
		const providerHost = this.getContextTarget(event, this.host);
		if (providerHost === this.host) return;

		// A newly connected nested provider should take over matching consumers.
		const seen = new Set<unknown>();
		for (const [callback, { consumerHost }] of this.subscriptions) {
			if (seen.has(callback)) continue;
			seen.add(callback);
			consumerHost.dispatchEvent(
				new ContextRequestEvent(this.context, consumerHost, callback, true),
			);
		}
		event.stopPropagation();
	};

	private notifySubscribers(): void {
		for (const subscription of this.subscriptions.values()) {
			subscription.callback(this.currentValue, subscription.unsubscribe);
		}
	}
}

export const provideContext = <T extends UnknownContext>(
	host: Element,
	options: ContextProviderOptions<T>,
): ContextProvider<T> => new ContextProvider(host, options);
