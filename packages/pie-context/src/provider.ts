import { ContextProviderEvent, ContextRequestEvent } from "./events.js";
import type { ContextType, UnknownContext } from "./types.js";

interface Subscription<ValueType> {
	callback: (value: ValueType, unsubscribe?: () => void) => void;
	unsubscribe: () => void;
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
		this.host.dispatchEvent(new ContextProviderEvent(this.context, this.host));
	}

	public disconnect(): void {
		if (!this.isConnected) return;
		this.isConnected = false;
		this.host.removeEventListener(
			"context-request",
			this.handleContextRequest as EventListener,
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

	private readonly handleContextRequest = (event: ContextRequestEvent) => {
		if (event.context !== this.context) return;
		if (event.contextTarget === this.host) return;

		// Closest provider wins for this context key.
		event.stopImmediatePropagation();

		if (!event.subscribe) {
			event.callback(this.currentValue);
			return;
		}

		const existing = this.subscriptions.get(event.callback);
		existing?.unsubscribe();

		const unsubscribe = () => {
			this.subscriptions.delete(event.callback);
		};

		this.subscriptions.set(event.callback, {
			callback: event.callback,
			unsubscribe,
		});
		event.callback(this.currentValue, unsubscribe);
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
