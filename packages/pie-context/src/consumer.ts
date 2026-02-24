import { ContextRequestEvent } from "./events.js";
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

	public requestValue(): void {
		this.host.dispatchEvent(
			new ContextRequestEvent(
				this.context,
				this.host,
				(value, unsubscribe) => {
					if (unsubscribe !== this.unsubscribe) {
						this.unsubscribe?.();
						this.unsubscribe = unsubscribe;
					}
					this.currentValue = value;
					this.onValue?.(value);
				},
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
