import type { ContextCallback, ContextType, UnknownContext } from "./types.js";

/**
 * Builds a protocol event on the `Event` of the realm `target` belongs to. A
 * DOM emulator's `dispatchEvent` accepts only its own realm's events, and a
 * page or a test run can hold several realms, so the base is chosen per event.
 * A class extending `Event` binds whichever `Event` was global when its module
 * loaded. A target outside any window takes the `Event` global now.
 */
function createProtocolEvent<Fields extends object>(
	type: string,
	target: Element,
	fields: Fields,
): Event & Fields {
	const RealmEvent = target.ownerDocument?.defaultView?.Event ?? Event;
	return Object.assign(
		new RealmEvent(type, { bubbles: true, composed: true }),
		fields,
	);
}

const requestEvents = new WeakSet<object>();
const providerEvents = new WeakSet<object>();

const isEventIn = (events: WeakSet<object>, value: unknown): boolean =>
	typeof value === "object" && value !== null && events.has(value);

export interface ContextRequestEvent<T extends UnknownContext = UnknownContext>
	extends Event {
	readonly context: T;
	readonly contextTarget: Element;
	readonly callback: ContextCallback<ContextType<T>>;
	readonly subscribe?: boolean;
}

/**
 * A `context-request`. Constructed with `new`, it is an `Event` of its
 * `contextTarget`'s realm carrying the request's fields, and `instanceof`
 * recognizes the events this copy of the package constructed. Providers and the
 * document root match requests by their fields, so a request another copy
 * constructed is answered too.
 */
export const ContextRequestEvent = class ContextRequestEvent {
	public constructor(
		context: UnknownContext,
		contextTarget: Element,
		callback: ContextCallback<unknown>,
		subscribe?: boolean,
	) {
		const event = createProtocolEvent("context-request", contextTarget, {
			context,
			contextTarget,
			callback,
			subscribe: subscribe ?? false,
		});
		requestEvents.add(event);
		// biome-ignore lint/correctness/noConstructorReturn: the event is built on its target's realm.
		return event;
	}

	public static [Symbol.hasInstance](value: unknown): boolean {
		return isEventIn(requestEvents, value);
	}
} as unknown as {
	new <T extends UnknownContext = UnknownContext>(
		context: T,
		contextTarget: Element,
		callback: ContextCallback<ContextType<T>>,
		subscribe?: boolean,
	): ContextRequestEvent<T>;
	readonly prototype: ContextRequestEvent;
};

export interface ContextProviderEvent<T extends UnknownContext = UnknownContext>
	extends Event {
	readonly context: T;
	readonly contextTarget: Element;
}

/** A `context-provider` announcement, built as {@link ContextRequestEvent} is. */
export const ContextProviderEvent = class ContextProviderEvent {
	public constructor(context: UnknownContext, contextTarget: Element) {
		const event = createProtocolEvent("context-provider", contextTarget, {
			context,
			contextTarget,
		});
		providerEvents.add(event);
		// biome-ignore lint/correctness/noConstructorReturn: the event is built on its target's realm.
		return event;
	}

	public static [Symbol.hasInstance](value: unknown): boolean {
		return isEventIn(providerEvents, value);
	}
} as unknown as {
	new <T extends UnknownContext = UnknownContext>(
		context: T,
		contextTarget: Element,
	): ContextProviderEvent<T>;
	readonly prototype: ContextProviderEvent;
};

declare global {
	interface HTMLElementEventMap {
		"context-request": ContextRequestEvent<UnknownContext>;
		"context-provider": ContextProviderEvent<UnknownContext>;
	}
}
