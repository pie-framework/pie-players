import type {
	ContextCallback,
	ContextType,
	UnknownContext,
} from "./types.js";

export class ContextRequestEvent<
	T extends UnknownContext = UnknownContext,
> extends Event {
	public readonly context: T;
	public readonly contextTarget: Element;
	public readonly callback: ContextCallback<ContextType<T>>;
	public readonly subscribe?: boolean;

	public constructor(
		context: T,
		contextTarget: Element,
		callback: ContextCallback<ContextType<T>>,
		subscribe?: boolean,
	) {
		super("context-request", { bubbles: true, composed: true });
		this.context = context;
		this.contextTarget = contextTarget;
		this.callback = callback;
		this.subscribe = subscribe;
	}
}

export class ContextProviderEvent<
	T extends UnknownContext = UnknownContext,
> extends Event {
	public readonly context: T;
	public readonly contextTarget: Element;

	public constructor(context: T, contextTarget: Element) {
		super("context-provider", { bubbles: true, composed: true });
		this.context = context;
		this.contextTarget = contextTarget;
	}
}

declare global {
	interface HTMLElementEventMap {
		"context-request": ContextRequestEvent<UnknownContext>;
		"context-provider": ContextProviderEvent<UnknownContext>;
	}
}
