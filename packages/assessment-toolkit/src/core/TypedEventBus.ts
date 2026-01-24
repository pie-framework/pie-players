/**
 * TypedEventBus
 *
 * Type-safe event bus built on native EventTarget.
 * Provides zero-dependency, standards-based event communication
 * between assessment components (items, tools, navigation, etc.).
 *
 * Features:
 * - Type safety via TypeScript discriminated unions
 * - Standard DOM CustomEvent with bubbles and composed
 * - Framework-agnostic (works across shadow DOM boundaries)
 * - No third-party dependencies
 *
 * Part of PIE Assessment Toolkit.
 */

export class TypedEventBus<
	EventMap extends Record<string, any>,
> extends EventTarget {
	/**
	 * Emit a typed event
	 *
	 * @param type Event type (must be key of EventMap)
	 * @param detail Event payload
	 * @returns true if event was dispatched successfully
	 */
	emit<K extends keyof EventMap>(type: K, detail: EventMap[K]): boolean {
		const event = new CustomEvent(String(type), {
			detail,
			bubbles: true,
			composed: true,
		});

		return this.dispatchEvent(event);
	}

	/**
	 * Listen for typed events
	 *
	 * @param type Event type to listen for
	 * @param listener Callback function receiving typed event
	 * @param options Standard addEventListener options
	 */
	on<K extends keyof EventMap>(
		type: K,
		listener: (event: CustomEvent<EventMap[K]>) => void,
		options?: AddEventListenerOptions,
	): void {
		this.addEventListener(String(type), listener as EventListener, options);
	}

	/**
	 * Remove event listener
	 *
	 * @param type Event type
	 * @param listener Callback to remove
	 */
	off<K extends keyof EventMap>(
		type: K,
		listener: (event: CustomEvent<EventMap[K]>) => void,
	): void {
		this.removeEventListener(String(type), listener as EventListener);
	}

	/**
	 * Listen for event once (automatically removes listener after first trigger)
	 *
	 * @param type Event type to listen for
	 * @param listener Callback function
	 */
	once<K extends keyof EventMap>(
		type: K,
		listener: (event: CustomEvent<EventMap[K]>) => void,
	): void {
		this.addEventListener(String(type), listener as EventListener, {
			once: true,
		});
	}
}
