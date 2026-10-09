/**
 * Section runtime engine adapter.
 *
 * The adapter is the single I/O seam between the pure FSM core
 * (`SectionEngineCore`) and the rest of the world (the DOM and host
 * subscribers). It does exactly two jobs:
 *
 *   1. Forward host-constructed `SectionEngineInput`s to the core via
 *      `core.dispatch(input)`.
 *
 *   2. Subscribe to the core's output stream and route each batch, in
 *      order, to the DOM-event bridge (`pie-stage-change`,
 *      `pie-loading-complete`) and then to the subscriber fan-out (one
 *      batch per `core.dispatch`).
 *
 * Output routing is a single exhaustive `switch`, so a new
 * `SectionEngineOutput` kind is a compile error here until the adapter
 * routes it.
 *
 * **Layering constraint.** The adapter is plain TS and must not import
 * `svelte`; `scripts/check-engine-core-purity.mjs` enforces it, so the
 * adapter stays usable from non-Svelte hosts and Node tests.
 */

import { SectionEngineCore } from "../core/SectionEngineCore.js";
import type { SectionEngineInput } from "../core/engine-input.js";
import type { SectionEngineOutput } from "../core/engine-output.js";
import type { SectionEngineState } from "../core/engine-state.js";
import {
	createDomEventBridge,
	type DomEventBridgeHandle,
} from "./dom-event-bridge.js";
import {
	createSubscriberFanout,
	type EngineOutputListener,
	type SubscriberFanoutHandle,
} from "./subscriber-fanout.js";

export interface SectionEngineAdapterOptions {
	/** Element on which DOM events are dispatched. */
	host: EventTarget;
	/** Stable runtime id for this engine instance. */
	runtimeId: string;
	/**
	 * Tag name of the host CE without the `--version-<encoded>` suffix.
	 */
	sourceCe: string;
	/** Clock injection for the DOM bridge. Defaults to `Date.now()`. */
	now?: () => string;
	/**
	 * Optional pre-constructed core. Defaults to a fresh
	 * `SectionEngineCore`. Tests pass a mocked core to assert dispatch
	 * ordering; production callers use the default.
	 */
	core?: SectionEngineCore;
}

export class SectionEngineAdapter {
	private readonly core: SectionEngineCore;
	private readonly domEventBridge: DomEventBridgeHandle;
	private readonly subscriberFanout: SubscriberFanoutHandle;
	private readonly unsubscribeCore: () => void;
	private disposed = false;

	constructor(options: SectionEngineAdapterOptions) {
		this.core = options.core ?? new SectionEngineCore();
		this.domEventBridge = createDomEventBridge({
			host: options.host,
			runtimeId: options.runtimeId,
			sourceCe: options.sourceCe,
			now: options.now,
		});
		this.subscriberFanout = createSubscriberFanout();

		this.unsubscribeCore = this.core.subscribe((outputs) => {
			this.routeOutputs(outputs);
		});
	}

	/**
	 * Read-only snapshot of the FSM state. Mirrors
	 * `SectionEngineCore.getState()`.
	 */
	getState(): Readonly<SectionEngineState> {
		return this.core.getState();
	}

	/**
	 * Forward a host-constructed input to the core. Returns the outputs
	 * that resulted (the bridges have already received them).
	 */
	dispatchInput(input: SectionEngineInput): readonly SectionEngineOutput[] {
		if (this.disposed) return [];
		return this.core.dispatch(input);
	}

	/**
	 * Subscribe to batched output streams, one batch per
	 * `dispatchInput`.
	 */
	subscribe(listener: EngineOutputListener): () => void {
		return this.subscriberFanout.subscribe(listener);
	}

	/**
	 * Update the host element after construction (e.g. when the kernel
	 * receives its host element via Svelte action / context).
	 */
	setHost(host: EventTarget): void {
		this.domEventBridge.setHost(host);
	}

	/**
	 * Tear the adapter down. Safe to call more than once. Emits `disposed`
	 * for the active cohort, then detaches the core subscription and
	 * clears subscribers.
	 */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		// Dispatch the FSM `dispose` input first so the disposed-stage
		// output flows through the bridges before we tear anything down.
		this.core.dispatch({ kind: "dispose" });
		this.unsubscribeCore();
		this.subscriberFanout.dispose();
	}

	private routeOutputs(outputs: readonly SectionEngineOutput[]): void {
		for (const output of outputs) {
			this.routeOne(output);
		}
		this.subscriberFanout.emit(outputs);
	}

	private routeOne(output: SectionEngineOutput): void {
		switch (output.kind) {
			case "stage-change":
			case "loading-complete":
				this.domEventBridge.dispatch(output);
				break;
			default: {
				const exhaustive: never = output;
				void exhaustive;
			}
		}
	}
}
