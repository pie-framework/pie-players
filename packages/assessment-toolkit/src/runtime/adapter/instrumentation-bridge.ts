/**
 * Instrumentation bridge for the section runtime engine adapter (M7 —
 * Variant C, layered).
 *
 * Forwards every `SectionEngineOutput` to an optional observability
 * hook the host injects (telemetry, debug logger, e2e probe). The
 * bridge is intentionally thin: it does not buffer, transform, or
 * filter. Hosts that need a different shape can run their own subscriber
 * via the adapter's public `subscribe(...)` channel.
 *
 * **Why a dedicated bridge instead of a generic subscriber.** The
 * subscriber-fanout channel is host-shaped — listeners receive batched
 * arrays of outputs per `core.dispatch` call so they can reason about
 * "what happened in this transition." The instrumentation hook is
 * per-output: telemetry pipelines want one record per stage change,
 * one record per readiness flip, etc. Splitting the channels keeps
 * both shapes ergonomic.
 *
 * The bridge **must not** import `svelte` per the M7 layering
 * constraint.
 */

import type { SectionEngineOutput } from "../core/engine-output.js";

export type InstrumentationHook = (output: SectionEngineOutput) => void;

export interface InstrumentationBridgeOptions {
	hook?: InstrumentationHook;
}

export interface InstrumentationBridgeHandle {
	dispatch(output: SectionEngineOutput): void;
	setHook(hook: InstrumentationHook | undefined): void;
}

export function createInstrumentationBridge(
	options: InstrumentationBridgeOptions = {},
): InstrumentationBridgeHandle {
	let hook: InstrumentationHook | undefined = options.hook;

	function dispatch(output: SectionEngineOutput): void {
		if (!hook) return;
		try {
			hook(output);
		} catch (error) {
			console.warn("[InstrumentationBridge] hook failed:", error);
		}
	}

	function setHook(next: InstrumentationHook | undefined): void {
		hook = next;
	}

	return { dispatch, setHook };
}
