/**
 * Framework-error bridge for the section runtime engine adapter (M7 —
 * Variant C, layered).
 *
 * Routes `framework-error` engine outputs into a `FrameworkErrorBus`
 * (write side: `FrameworkErrorReporter`). The bus is the single
 * fan-out point shared with the toolkit CE's banner, the coordinator's
 * canonical `onFrameworkError` lifecycle hook, and any direct host
 * subscribers via `subscribeFrameworkErrors`. See
 * `packages/assessment-toolkit/src/services/framework-error-bus.ts`
 * for the full bus contract.
 *
 * **Why a separate bridge.** The dom-event-bridge dispatches the
 * `framework-error` DOM event on the host. The framework-error-bridge
 * routes the same model into the in-process bus so listeners that
 * subscribe via `coordinator.subscribeFrameworkErrors(...)` see the
 * same fan-out with byte-identical payloads. Splitting the
 * responsibilities lets a host opt out of either side (DOM-only or
 * bus-only) without re-implementing the other.
 *
 * **Bus ownership.** The bridge does not construct the bus; the
 * adapter receives one externally so the toolkit CE can keep sharing
 * its bus with the coordinator (matching today's
 * `PieAssessmentToolkit.svelte` lifetime model). This avoids the
 * "second bus" pitfall — a dual-bus topology would silently fragment
 * fan-out.
 */

import type { FrameworkErrorReporter } from "../../services/framework-error-bus.js";
import type { SectionEngineOutput } from "../core/engine-output.js";

export interface FrameworkErrorBridgeOptions {
	bus: FrameworkErrorReporter;
}

export interface FrameworkErrorBridgeHandle {
	dispatch(output: SectionEngineOutput): void;
}

export function createFrameworkErrorBridge(
	options: FrameworkErrorBridgeOptions,
): FrameworkErrorBridgeHandle {
	const { bus } = options;

	function dispatch(output: SectionEngineOutput): void {
		switch (output.kind) {
			case "framework-error":
				bus.reportFrameworkError(output.error);
				return;
			case "stage-change":
			case "loading-complete":
				return;
			default: {
				const exhaustive: never = output;
				void exhaustive;
				return;
			}
		}
	}

	return { dispatch };
}
