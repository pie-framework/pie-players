/**
 * Subscriber fan-out for the section runtime engine adapter (M7 — Variant
 * C, layered).
 *
 * The adapter exposes a single `subscribe(listener)` channel for hosts
 * that want a synchronous stream of `SectionEngineOutput[]` batches —
 * one batch per `core.dispatch(input)` call.
 *
 * **Why not reuse `SectionEngineCore.subscribe` directly.** The core
 * channel is the engine's internal contract. The fan-out is the
 * adapter's public channel: it is the single seam every facade method
 * goes through, and the only seam that ever sees host-side errors. The
 * separation lets us swap the core implementation (or skip it for
 * tests) without changing the public subscriber shape.
 *
 * **Subscriber contract.** Mirrors `SectionEngineCore.subscribe`:
 *   - Listeners are invoked synchronously, in registration order.
 *   - A listener that throws is caught and `console.warn`-logged. Fan-out
 *     is not interrupted — same isolation guarantee as
 *     `FrameworkErrorBus`.
 *   - The disposer returned from `subscribe` is idempotent.
 *   - Listeners receive a frozen, defensively-copied output array.
 *   - There is no replay; subscribe at adapter construction time if you
 *     need every output from `idle` onward.
 */

import type { SectionEngineOutput } from "../core/engine-output.js";

export type EngineOutputListener = (
	outputs: readonly SectionEngineOutput[],
) => void;

export interface SubscriberFanoutHandle {
	emit(outputs: readonly SectionEngineOutput[]): void;
	subscribe(listener: EngineOutputListener): () => void;
	dispose(): void;
	getListenerCount(): number;
}

export function createSubscriberFanout(): SubscriberFanoutHandle {
	const listeners = new Set<EngineOutputListener>();

	function emit(outputs: readonly SectionEngineOutput[]): void {
		if (outputs.length === 0) return;
		const snapshot = Array.from(listeners);
		const frozen = Object.freeze(outputs.slice());
		for (const listener of snapshot) {
			try {
				listener(frozen);
			} catch (error) {
				console.warn("[SubscriberFanout] listener failed:", error);
			}
		}
	}

	function subscribe(listener: EngineOutputListener): () => void {
		listeners.add(listener);
		let attached = true;
		return () => {
			if (!attached) return;
			attached = false;
			listeners.delete(listener);
		};
	}

	function dispose(): void {
		listeners.clear();
	}

	function getListenerCount(): number {
		return listeners.size;
	}

	return { emit, subscribe, dispose, getListenerCount };
}
