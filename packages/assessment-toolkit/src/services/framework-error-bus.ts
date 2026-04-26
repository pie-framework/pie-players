import type { FrameworkErrorModel } from "./framework-error.js";

/**
 * Listener invoked once per `reportFrameworkError` call.
 *
 * Listeners are called synchronously, in registration order. A listener
 * that throws is caught and logged; the throw does not stop fan-out to
 * the remaining listeners.
 */
export type FrameworkErrorListener = (model: FrameworkErrorModel) => void;

/**
 * Read side of the bus — the surface a host or sub-shell consumes.
 *
 * Mirrors the shape `subscribeTelemetry` exposes on
 * `ToolkitCoordinatorApi`: a `subscribe(listener)` returning a disposer.
 */
export interface FrameworkErrorPort {
	subscribeFrameworkErrors(listener: FrameworkErrorListener): () => void;
}

/**
 * Write side of the bus — the surface an internal failure path uses to
 * publish a model.
 *
 * Kept separate from the read port so callers (e.g. the coordinator)
 * receive only the capability they actually need.
 */
export interface FrameworkErrorReporter {
	reportFrameworkError(model: FrameworkErrorModel): void;
}

/**
 * Package-internal multi-subscriber framework-error bus.
 *
 * **Design contract.**
 *
 * - **Synchronous fan-out.** `reportFrameworkError(model)` calls every
 *   subscribed listener in registration order before returning. There is
 *   no buffering, no microtask deferral, no replay of past errors.
 * - **Listener isolation.** A listener that throws is caught and
 *   `console.warn`-logged; the throw does not interrupt fan-out to the
 *   remaining listeners.
 * - **Snapshot iteration.** The fan-out iterates over a snapshot of the
 *   listener set so that a listener that subscribes / unsubscribes
 *   during its own delivery does not mutate the in-flight iteration.
 * - **Idempotent unsubscribe.** Calling the returned disposer twice is
 *   a no-op; the listener is removed on the first call.
 * - **No replay.** Late subscribers do not see errors emitted before
 *   they subscribed. Hosts that need an "error already happened" signal
 *   should subscribe at construction time. The toolkit CE does this
 *   before constructing the coordinator so the `coordinator-init`
 *   failure path emits through the same bus.
 *
 * **Why not a public class.** This bus is constructed inside the toolkit
 * CE (`PieAssessmentToolkit.svelte`) and passed into
 * `ToolkitCoordinator`. Hosts subscribe via
 * `ToolkitCoordinatorApi.subscribeFrameworkErrors`, never via the bus
 * class itself. Keeping the class package-internal lets us iterate on
 * its shape without a public-API change.
 */
export class FrameworkErrorBus implements FrameworkErrorPort, FrameworkErrorReporter {
	private readonly listeners = new Set<FrameworkErrorListener>();

	subscribeFrameworkErrors(listener: FrameworkErrorListener): () => void {
		this.listeners.add(listener);
		let attached = true;
		return () => {
			if (!attached) return;
			attached = false;
			this.listeners.delete(listener);
		};
	}

	reportFrameworkError(model: FrameworkErrorModel): void {
		const snapshot = Array.from(this.listeners);
		for (const listener of snapshot) {
			try {
				listener(model);
			} catch (error) {
				console.warn(
					"[FrameworkErrorBus] listener failed:",
					error,
				);
			}
		}
	}

	/**
	 * Detach all listeners. Used by the toolkit CE on disconnect.
	 */
	dispose(): void {
		this.listeners.clear();
	}

	/**
	 * Test-only inspection. Not part of the public contract.
	 *
	 * @internal
	 */
	getListenerCount(): number {
		return this.listeners.size;
	}
}
