/**
 * Section runtime engine — pure core (M7 — Variant C, layered).
 *
 * `SectionEngineCore` is a thin object oriented wrapper over the pure
 * `transition()` function. It owns the current `SectionEngineState`,
 * applies inputs serially, and fans out the resulting
 * `SectionEngineOutput[]` to subscribers. There is no DOM, Svelte,
 * coordinator, or timing dependency in this module — all I/O lives in
 * the adapter layer (PR 2).
 *
 * Lifetime model:
 *   - One instance per cohort logical lifetime. Cohort changes happen
 *     through `dispatch({ kind: "cohort-change" })`, not through
 *     re-construction.
 *   - After a `dispose` input, additional inputs are no-ops (the
 *     transition handles this), but subscribers stay attached so the
 *     adapter can still deliver final cleanup outputs.
 *
 * Subscriber contract:
 *   - Listeners are invoked synchronously, in registration order.
 *   - A throwing listener is caught and `console.warn`-logged. Fan-out
 *     is not interrupted — same isolation guarantee as
 *     `FrameworkErrorBus`.
 *   - The disposer returned from `subscribe` is idempotent.
 *   - Listeners receive only the output array. State snapshots are
 *     read via `getState()` for callers that need them.
 */

import type { SectionEngineInput } from "./engine-input.js";
import type { SectionEngineOutput } from "./engine-output.js";
import {
	createInitialEngineState,
	type SectionEngineState,
} from "./engine-state.js";
import { transition } from "./engine-transition.js";

export type SectionEngineCoreListener = (
	outputs: readonly SectionEngineOutput[],
) => void;

export class SectionEngineCore {
	private state: SectionEngineState = createInitialEngineState();
	private readonly listeners = new Set<SectionEngineCoreListener>();

	/** Read-only state snapshot. Callers must not mutate the returned object. */
	getState(): Readonly<SectionEngineState> {
		return this.state;
	}

	/**
	 * Apply one input. Returns the outputs that resulted from the
	 * transition; subscribers also receive them.
	 */
	dispatch(input: SectionEngineInput): readonly SectionEngineOutput[] {
		const result = transition(this.state, input);
		this.state = result.state;
		if (result.outputs.length > 0) {
			this.fanOut(result.outputs);
		}
		return result.outputs;
	}

	/**
	 * Subscribe to engine outputs. Returns an idempotent disposer.
	 * Listeners do not receive a replay of past outputs; subscribe at
	 * construction time if you need every output from `idle` onward.
	 */
	subscribe(listener: SectionEngineCoreListener): () => void {
		this.listeners.add(listener);
		let attached = true;
		return () => {
			if (!attached) return;
			attached = false;
			this.listeners.delete(listener);
		};
	}

	/** Test-only: detach every listener. */
	disposeListeners(): void {
		this.listeners.clear();
	}

	private fanOut(outputs: SectionEngineOutput[]): void {
		const snapshot = Array.from(this.listeners);
		const frozen = Object.freeze(outputs.slice());
		for (const listener of snapshot) {
			try {
				listener(frozen);
			} catch (error) {
				console.warn("[SectionEngineCore] listener failed:", error);
			}
		}
	}
}
