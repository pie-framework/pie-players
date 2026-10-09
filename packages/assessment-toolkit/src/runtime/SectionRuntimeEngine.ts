/**
 * Section runtime engine — the section player's stage chain.
 *
 * The section player's layout kernel owns one per layout element and drives it
 * with `dispatchInput`: the cohort it shows (`initialize`, `cohort-change`,
 * `update-runtime`), the controller resolving (`section-controller-resolved`),
 * and the readiness signals it derives (`update-readiness-signals`). The pure
 * FSM core turns those into `pie-stage-change` and `pie-loading-complete`,
 * which the adapter dispatches on the layout element, bubbling and composed;
 * `subscribe` receives the same outputs in batches.
 *
 * The engine is the only stage emitter. It holds no controller and no
 * registry: the toolkit's `SectionControllerBinding` owns those. The kernel
 * learns that the controller resolved from the toolkit's `section-ready`, whose
 * detail carries the controller and its cohort.
 *
 * `attachHost(...)` builds the adapter on first call; a later call moves it to
 * a new host element.
 */

import { SectionEngineAdapter } from "./adapter/SectionEngineAdapter.js";
import type { EngineOutputListener } from "./adapter/subscriber-fanout.js";
import type { SectionEngineInput } from "./core/engine-input.js";
import type { SectionEngineOutput } from "./core/engine-output.js";
import {
	createInitialEngineState,
	type SectionEngineState,
} from "./core/engine-state.js";
import { createRuntimeId } from "./runtime-id.js";

/** `attachHost` args: the element events are dispatched on, and its tag. */
export interface SectionRuntimeEngineHostArgs {
	host: EventTarget;
	sourceCe: string;
	now?: () => string;
}

export class SectionRuntimeEngine {
	private readonly runtimeId = createRuntimeId("section-engine");
	private adapter: SectionEngineAdapter | null = null;

	/**
	 * Attach the host element and `sourceCe` the adapter dispatches DOM events
	 * with. Required before `dispatchInput` / `subscribe` produce observable
	 * effects.
	 *
	 * Constructs the adapter on the first call. Subsequent calls keep the
	 * adapter and update its host element.
	 */
	attachHost(args: SectionRuntimeEngineHostArgs): void {
		if (this.adapter) {
			this.adapter.setHost(args.host);
			return;
		}
		this.adapter = new SectionEngineAdapter({
			host: args.host,
			runtimeId: this.runtimeId,
			sourceCe: args.sourceCe,
			now: args.now,
		});
	}

	/**
	 * Forward a host-constructed input to the FSM core via the adapter.
	 * Returns the outputs the transition produced (subscribers and the
	 * DOM bridge have already received them).
	 *
	 * No-op (returns `[]`) before `attachHost(...)` so callers that
	 * dispatch optimistically during teardown do not throw.
	 */
	dispatchInput(input: SectionEngineInput): readonly SectionEngineOutput[] {
		return this.adapter?.dispatchInput(input) ?? [];
	}

	/**
	 * Subscribe to batched engine outputs (one batch per
	 * `dispatchInput`). Returns an idempotent disposer. Pre-`attachHost`
	 * subscriptions return a no-op disposer so callers can wire
	 * subscriptions early without lifecycle-ordering hazards.
	 */
	subscribe(listener: EngineOutputListener): () => void {
		return this.adapter?.subscribe(listener) ?? noopDispose;
	}

	/**
	 * Read-only snapshot of the FSM state. Returns the initial idle
	 * state before `attachHost` so callers can probe state without
	 * special-casing the pre-attach phase.
	 */
	getState(): Readonly<SectionEngineState> {
		return this.adapter?.getState() ?? createInitialEngineState();
	}

	/**
	 * Stable per-engine runtime id, the `runtimeId` of every event detail the
	 * engine dispatches.
	 */
	getRuntimeId(): string {
		return this.runtimeId;
	}

	/**
	 * Emit `disposed` for the active cohort and detach. Idempotent; inputs
	 * after it are ignored.
	 */
	dispose(): void {
		const adapter = this.adapter;
		if (!adapter) return;
		this.adapter = null;
		adapter.dispose();
	}
}

const noopDispose = (): void => {};
