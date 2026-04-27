/**
 * Section runtime engine adapter (M7 — Variant C, layered).
 *
 * The adapter is the single I/O seam between the pure FSM core
 * (`SectionEngineCore`) and the rest of the world (DOM, coordinator,
 * framework-error bus, host subscribers, instrumentation). It does
 * exactly two jobs:
 *
 *   1. Translate **host inputs** (from kernels, the toolkit CE, or
 *      direct facade callers) into `SectionEngineInput`s and forward
 *      them to the core via `core.dispatch(input)`.
 *
 *   2. Subscribe to the core's output stream and **route each output**
 *      through the bridges in a deterministic order so the public DOM
 *      surface, framework-error bus, legacy events, instrumentation
 *      hook, and host subscribers all see exactly the same fan-out
 *      with byte-identical detail shapes.
 *
 * Output routing is a single exhaustive `switch` (`assertNever` on
 * the default branch) so adding a new `SectionEngineOutput` kind in
 * `engine-output.ts` is a compile error here until the adapter knows
 * what to do with it.
 *
 * **Routing order per output:**
 *   - canonical DOM event (`pie-stage-change`, `pie-loading-complete`,
 *     `framework-error`)
 *   - legacy DOM event (`readiness-change`, `interaction-ready`,
 *     `ready`)
 *   - framework-error bus (single fan-out for in-process subscribers)
 *   - instrumentation hook
 *   - public subscriber fan-out (batched, runs once per
 *     `core.dispatch`)
 *
 * The order matches the kernel's existing emit chain so PR 5 (kernel
 * switch) is a structural delete, not a behavior change.
 *
 * **Layering constraint.** The adapter is plain TS. It must not
 * import `svelte` — the M7 implementation plan and
 * `scripts/check-engine-core-purity.mjs` enforce the core's purity;
 * the adapter follows the same constraint by convention so it stays
 * usable from non-Svelte hosts (Node tests, Storybook, or future
 * non-Svelte consumers). `bun run check:custom-elements` already
 * blocks `.svelte` imports in published `dist`; adding a Svelte
 * dependency here would also leak through that gate.
 */

import type { FrameworkErrorReporter } from "../../services/framework-error-bus.js";
import { SectionEngineCore } from "../core/SectionEngineCore.js";
import type { SectionEngineInput } from "../core/engine-input.js";
import type { SectionEngineOutput } from "../core/engine-output.js";
import type { SectionEngineState } from "../core/engine-state.js";
import {
	createCoordinatorBridge,
	type CoordinatorBridgeHandle,
	type CoordinatorPort,
	type ResolveSectionControllerArgs,
} from "./coordinator-bridge.js";
import {
	createDomEventBridge,
	type DomEventBridgeHandle,
} from "./dom-event-bridge.js";
import {
	createFrameworkErrorBridge,
	type FrameworkErrorBridgeHandle,
} from "./framework-error-bridge.js";
import {
	createInstrumentationBridge,
	type InstrumentationBridgeHandle,
	type InstrumentationHook,
} from "./instrumentation-bridge.js";
import {
	createLegacyEventBridge,
	type LegacyEventBridgeHandle,
} from "./legacy-event-bridge.js";
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
	/**
	 * Optional toolkit coordinator. When supplied, the adapter wires
	 * its framework-error subscription, controller resolution, and
	 * disposal through the coordinator-bridge. Standalone callers (no
	 * coordinator) can omit this and feed `framework-error` and
	 * `section-controller-resolved` inputs directly.
	 */
	coordinator?: CoordinatorPort;
	/** Optional one-shot observability hook. */
	instrumentationHook?: InstrumentationHook;
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
	private readonly legacyEventBridge: LegacyEventBridgeHandle;
	private readonly frameworkErrorBridge: FrameworkErrorBridgeHandle;
	private readonly instrumentationBridge: InstrumentationBridgeHandle;
	private readonly subscriberFanout: SubscriberFanoutHandle;
	private readonly coordinatorBridge: CoordinatorBridgeHandle | null;
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
		this.legacyEventBridge = createLegacyEventBridge({
			host: options.host,
		});
		this.frameworkErrorBridge = createFrameworkErrorBridge({
			bus: options.frameworkErrorBus,
		});
		this.instrumentationBridge = createInstrumentationBridge({
			hook: options.instrumentationHook,
		});
		this.subscriberFanout = createSubscriberFanout();
		this.coordinatorBridge = options.coordinator
			? createCoordinatorBridge({
					coordinator: options.coordinator,
					dispatchCoreInput: (input) => this.dispatchInput(input),
				})
			: null;

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
		this.legacyEventBridge.setHost(host);
	}

	/**
	 * Update the instrumentation hook at runtime.
	 */
	setInstrumentationHook(hook: InstrumentationHook | undefined): void {
		this.instrumentationBridge.setHook(hook);
	}

	/**
	 * Resolve a section controller through the configured coordinator.
	 *
	 * Throws if the adapter was constructed without a coordinator.
	 * Standalone callers should manually feed
	 * `{ kind: "section-controller-resolved" }` after their own
	 * controller resolution path completes.
	 */
	resolveSectionController(args: ResolveSectionControllerArgs): Promise<void> {
		if (!this.coordinatorBridge) {
			throw new Error(
				"[SectionEngineAdapter] resolveSectionController called without a coordinator.",
			);
		}
		return this.coordinatorBridge.resolveSectionController(args);
	}

	/**
	 * Tear the adapter down. Safe to call more than once. Disposes the
	 * coordinator bridge (which in turn disposes the section
	 * controller for the current cohort), detaches the core
	 * subscription, and clears subscribers.
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
		if (this.coordinatorBridge) {
			await this.coordinatorBridge.dispose();
		}
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
			case "readiness-change":
			case "interaction-ready":
			case "ready":
				this.legacyEventBridge.dispatch(output);
				break;
			default: {
				const exhaustive: never = output;
				void exhaustive;
				return;
			}
		}
		this.instrumentationBridge.dispatch(output);
	}
}
