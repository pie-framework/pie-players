/**
 * Section runtime engine adapter.
 *
 * The adapter is the single I/O seam between the pure FSM core
 * (`SectionEngineCore`) and the rest of the world (DOM, framework-error
 * bus, host subscribers). It does exactly two jobs:
 *
 *   1. Translate **host inputs** (from kernels, the toolkit CE, or
 *      direct facade callers) into `SectionEngineInput`s and forward
 *      them to the core via `core.dispatch(input)`.
 *
 *   2. Subscribe to the core's output stream and **route each output**
 *      through the bridges in a deterministic order so the public DOM
 *      surface, framework-error bus, and host subscribers all see
 *      exactly the same fan-out with
 *      byte-identical detail shapes.
 *
 * Output routing is a single exhaustive `switch` (`assertNever` on
 * the default branch) so adding a new `SectionEngineOutput` kind in
 * `engine-output.ts` is a compile error here until the adapter knows
 * what to do with it.
 *
 * **Routing order per output:**
 *   - canonical DOM event (`pie-stage-change`, `pie-loading-complete`,
 *     `framework-error`)
 *   - framework-error bus (single fan-out for in-process subscribers)
 *   - public subscriber fan-out (batched, runs once per
 *     `core.dispatch`)
 *
 * The `readiness-change` / `interaction-ready` / `ready`
 * DOM events and their event bridge were removed in the
 * broad architecture review compat sweep; the corresponding output
 * kinds are gone from `engine-output.ts`.
 *
 * **Layering constraint.** The adapter is plain TS. It must not
 * import `svelte` — `scripts/check-engine-core-purity.mjs` enforces
 * the core's purity;
 * the adapter follows the same constraint by convention so it stays
 * usable from non-Svelte hosts (Node tests, Storybook, or future
 * non-Svelte consumers). `bun run check:custom-elements:dist`
 * already blocks `.svelte` imports in published `dist`; adding a
 * Svelte dependency here would also leak through that gate.
 */

import type { FrameworkErrorReporter } from "../../services/framework-error-bus.js";
import { SectionEngineCore } from "../core/SectionEngineCore.js";
import type { SectionEngineInput } from "../core/engine-input.js";
import type { SectionEngineOutput } from "../core/engine-output.js";
import type { SectionEngineState } from "../core/engine-state.js";
import {
	createDomEventBridge,
	type DomEventBridgeHandle,
} from "./dom-event-bridge.js";
import {
	createFrameworkErrorBridge,
	type FrameworkErrorBridgeHandle,
} from "./framework-error-bridge.js";
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
	/**
	 * Framework-error bus (write side). Shared with the toolkit CE so
	 * subscribers via `coordinator.subscribeFrameworkErrors` see the
	 * same fan-out.
	 */
	frameworkErrorBus: FrameworkErrorReporter;
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
	private readonly frameworkErrorBridge: FrameworkErrorBridgeHandle;
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
		this.frameworkErrorBridge = createFrameworkErrorBridge({
			bus: options.frameworkErrorBus,
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
	 * Tear the adapter down. Safe to call more than once. Detaches the
	 * core subscription and clears subscribers.
	 *
	 * Does **not** dispose the framework-error bus — its lifetime is
	 * owned by the toolkit CE / host.
	 */
	async dispose(): Promise<void> {
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
			case "framework-error":
				this.domEventBridge.dispatch(output);
				this.frameworkErrorBridge.dispatch(output);
				break;
			default: {
				const exhaustive: never = output;
				void exhaustive;
			}
		}
	}
}
