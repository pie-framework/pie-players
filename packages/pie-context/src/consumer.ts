import { type ContextProviderEvent, ContextRequestEvent } from "./events.js";
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
		this.requestValue();
	}

	public disconnect(): void {
		if (!this.isConnected) return;
		this.isConnected = false;
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

const PROVIDER_RETRY_INTERVAL_MS = 50;
const PROVIDER_RETRY_MAX_ATTEMPTS = 200;

/**
 * Subscribe `host` to `context` for a provider that may connect after it.
 * The consumer requests again when a matching `context-provider` event
 * reaches `host`, and every 50 ms until it has a value, for up to 200
 * attempts (about 10 s). Returns a cleanup that stops retrying and
 * disconnects.
 */
export const connectContextWithRetry = <T extends UnknownContext>(
	host: Element,
	context: T,
	onValue: (value: ContextType<T>) => void,
): (() => void) => {
	let hasValue = false;
	const consumer = new ContextConsumer(host, {
		context,
		subscribe: true,
		onValue: (value) => {
			hasValue = true;
			onValue(value);
		},
	});
	consumer.connect();

	const onContextProvider = (event: Event) => {
		if ((event as ContextProviderEvent).context !== context) return;
		consumer.requestValue();
	};
	host.addEventListener("context-provider", onContextProvider);

	let attempts = 0;
	const retryTimer = globalThis.setInterval(() => {
		if (hasValue || attempts >= PROVIDER_RETRY_MAX_ATTEMPTS) {
			globalThis.clearInterval(retryTimer);
			return;
		}
		attempts += 1;
		consumer.requestValue();
	}, PROVIDER_RETRY_INTERVAL_MS);

	return () => {
		globalThis.clearInterval(retryTimer);
		host.removeEventListener("context-provider", onContextProvider);
		consumer.disconnect();
	};
};
