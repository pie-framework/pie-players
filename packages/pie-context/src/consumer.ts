import { type ContextProviderEvent, ContextRequestEvent } from "./events.js";
import { ensureDocumentContextRoot } from "./root.js";
import type { ContextType, UnknownContext } from "./types.js";

export interface ContextConsumerOptions<T extends UnknownContext> {
	context: T;
	subscribe?: boolean;
	onValue?: (value: ContextType<T>) => void;
}

export class ContextConsumer<T extends UnknownContext> {
	private readonly host: Element;
	private readonly context: T;
	private readonly subscribe: boolean;
	private readonly onValue?: (value: ContextType<T>) => void;
	private isConnected = false;
	private isDisconnected = false;
	private unsubscribe?: () => void;
	private currentValue?: ContextType<T>;

	public constructor(host: Element, options: ContextConsumerOptions<T>) {
		this.host = host;
		this.context = options.context;
		this.subscribe = options.subscribe ?? true;
		this.onValue = options.onValue;
	}

	public connect(): void {
		if (this.isConnected) return;
		this.isConnected = true;
		this.isDisconnected = false;
		// The document's root replays this request to a provider that connects
		// later, so it has to be listening before the request is made.
		if (this.subscribe) ensureDocumentContextRoot(this.host.ownerDocument);
		this.requestValue();
	}

	public disconnect(): void {
		if (!this.isConnected) return;
		this.isConnected = false;
		this.isDisconnected = true;
		this.unsubscribe?.();
		this.unsubscribe = undefined;
	}

	public get value(): ContextType<T> | undefined {
		return this.currentValue;
	}

	private readonly handleValue = (
		value: ContextType<T>,
		unsubscribe?: () => void,
	): void => {
		// A request recorded before `disconnect` can still be replayed and
		// answered; the subscription that answer made is released at once.
		if (this.isDisconnected) {
			unsubscribe?.();
			return;
		}
		if (unsubscribe !== this.unsubscribe) {
			this.unsubscribe?.();
			this.unsubscribe = unsubscribe;
		}
		if (!this.subscribe && this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = undefined;
		}
		this.currentValue = value;
		this.onValue?.(value);
	};

	public requestValue(): void {
		this.host.dispatchEvent(
			new ContextRequestEvent(
				this.context,
				this.host,
				this.handleValue,
				this.subscribe,
			),
		);
	}
}

export const consumeContext = <T extends UnknownContext>(
	host: Element,
	options: ContextConsumerOptions<T>,
): ContextConsumer<T> => new ContextConsumer(host, options);

export const requestContext = <T extends UnknownContext>(
	host: Element,
	context: T,
): ContextType<T> | undefined => {
	let value: ContextType<T> | undefined;
	host.dispatchEvent(
		new ContextRequestEvent(
			context,
			host,
			(nextValue) => {
				value = nextValue;
			},
			false,
		),
	);
	return value;
};

/**
 * Subscribe `host` to `context` for a provider that may connect after it.
 * The document's context root replays the request when that provider
 * announces itself, and the consumer requests again when a matching
 * `context-provider` event reaches `host`. With no provider the consumer
 * stays unanswered, and the caller keeps its defaults. Returns a cleanup
 * that disconnects.
 */
export const connectContextWithRetry = <T extends UnknownContext>(
	host: Element,
	context: T,
	onValue: (value: ContextType<T>) => void,
): (() => void) => {
	const consumer = new ContextConsumer(host, {
		context,
		subscribe: true,
		onValue,
	});
	consumer.connect();

	const onContextProvider = (event: Event) => {
		if ((event as ContextProviderEvent).context !== context) return;
		consumer.requestValue();
	};
	host.addEventListener("context-provider", onContextProvider);

	return () => {
		host.removeEventListener("context-provider", onContextProvider);
		consumer.disconnect();
	};
};
