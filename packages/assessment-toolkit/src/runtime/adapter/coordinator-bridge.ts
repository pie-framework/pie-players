/**
 * Coordinator bridge for the section runtime engine adapter (M7 —
 * Variant C, layered).
 *
 * Unlike the DOM / legacy / framework-error bridges (which translate
 * **outputs** into I/O), the coordinator bridge is an **input source**:
 * it listens to a `ToolkitCoordinator` and feeds the resulting events
 * into the core via the `dispatchCoreInput` callback supplied by the
 * adapter.
 *
 * Responsibilities:
 *   1. **Framework-error subscription.** When the coordinator reports
 *      a framework error through its bus, dispatch a
 *      `{ kind: "framework-error" }` core input. Listener isolation
 *      matches `FrameworkErrorBus`: a throwing bridge handler is
 *      caught and `console.warn`-logged so the original fan-out is
 *      not interrupted.
 *
 *   2. **Section-controller resolution.** When the host calls
 *      `resolveSectionController({ ... })`, the bridge invokes
 *      `coordinator.getOrCreateSectionController({ ... })` and, on
 *      successful resolution, dispatches
 *      `{ kind: "section-controller-resolved" }` to the core. Init
 *      tokens guard against late resolutions overwriting a more
 *      recent cohort (mirrors `SectionRuntimeEngine.initialize`'s
 *      `activeInitToken` pattern).
 *
 *   3. **Disposal.** On `dispose()`, the bridge unsubscribes from the
 *      framework-error bus and (if the engine owns the section
 *      controller for the cohort) calls
 *      `coordinator.disposeSectionController({ ... })`. It does
 *      **not** dispose the coordinator itself — the coordinator's
 *      lifetime is owned by the toolkit CE / host, not by the engine.
 *
 * Disposal is idempotent: calling `dispose()` twice is a no-op.
 *
 * The bridge **must not** import `svelte`.
 */

import type {
	SectionControllerEvent,
	SectionControllerHandle,
} from "../../services/section-controller-types.js";
import type { CohortKey } from "../core/cohort.js";
import type { SectionEngineInput } from "../core/engine-input.js";

/**
 * Subset of the `ToolkitCoordinator` surface the bridge consumes. Kept
 * structural so tests can pass a fake without pulling the full
 * coordinator.
 */
export interface CoordinatorPort {
	subscribeFrameworkErrors(
		listener: (
			model: import("../../services/framework-error.js").FrameworkErrorModel,
		) => void,
	): () => void;

	getOrCreateSectionController(args: {
		sectionId: string;
		attemptId?: string;
		input?: unknown;
		updateExisting?: boolean;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle>;

	disposeSectionController(args: {
		sectionId: string;
		attemptId?: string;
	}): Promise<void>;
}

export interface ResolveSectionControllerArgs {
	cohort: CohortKey;
	assessmentId: string;
	view: string;
	section: unknown;
	createDefaultController: () =>
		| SectionControllerHandle
		| Promise<SectionControllerHandle>;
	/**
	 * Optional callback invoked when the controller resolves and on
	 * every controller `subscribe` event. The kernel uses this to keep
	 * its composition snapshot in sync with the controller's view.
	 *
	 * The bridge is responsible for unsubscribing on dispose / cohort
	 * change so a stale controller doesn't keep emitting after rollover.
	 */
	onCompositionChanged?: (composition: unknown) => void;
	/**
	 * Optional callback invoked once with the resolved controller handle
	 * the moment it is available. Lets the host keep a reference for
	 * direct method calls (e.g. `navigateToItem`, `applySession`)
	 * without re-querying the coordinator.
	 */
	onControllerResolved?: (controller: SectionControllerHandle) => void;
}

export interface CoordinatorBridgeOptions {
	coordinator: CoordinatorPort;
	dispatchCoreInput: (input: SectionEngineInput) => void;
}

export interface CoordinatorBridgeHandle {
	resolveSectionController(args: ResolveSectionControllerArgs): Promise<void>;
	dispose(): Promise<void>;
}

export function createCoordinatorBridge(
	options: CoordinatorBridgeOptions,
): CoordinatorBridgeHandle {
	const { coordinator, dispatchCoreInput } = options;

	let activeInitToken = 0;
	let activeCohort: CohortKey | null = null;
	let unsubscribeController: (() => void) | null = null;
	let disposed = false;

	const unsubscribeFrameworkErrors = coordinator.subscribeFrameworkErrors(
		(model) => {
			try {
				dispatchCoreInput({ kind: "framework-error", error: model });
			} catch (error) {
				console.warn(
					"[CoordinatorBridge] framework-error dispatch failed:",
					error,
				);
			}
		},
	);

	function detachControllerSubscription(): void {
		if (!unsubscribeController) return;
		try {
			unsubscribeController();
		} catch (error) {
			console.warn("[CoordinatorBridge] controller unsubscribe failed:", error);
		}
		unsubscribeController = null;
	}

	async function resolveSectionController(
		args: ResolveSectionControllerArgs,
	): Promise<void> {
		if (disposed) return;
		activeInitToken += 1;
		const token = activeInitToken;
		activeCohort = args.cohort;

		const controller = await coordinator.getOrCreateSectionController({
			sectionId: args.cohort.sectionId,
			attemptId: args.cohort.attemptId || undefined,
			input: {
				section: args.section,
				sectionId: args.cohort.sectionId,
				assessmentId: args.assessmentId,
				view: args.view,
			},
			updateExisting: true,
			createDefaultController: args.createDefaultController,
		});

		// Drop late resolutions — a cohort change or dispose may have
		// rolled the token forward while we awaited the coordinator.
		if (token !== activeInitToken || disposed) return;

		detachControllerSubscription();

		args.onControllerResolved?.(controller);

		const getCompositionModel = (
			controller as SectionControllerHandle & {
				getCompositionModel?: () => unknown;
			}
		).getCompositionModel;
		args.onCompositionChanged?.(getCompositionModel?.());

		if (typeof controller.subscribe === "function") {
			unsubscribeController = controller.subscribe(
				(_event: SectionControllerEvent) => {
					if (token !== activeInitToken || disposed) return;
					args.onCompositionChanged?.(getCompositionModel?.());
				},
			);
		}

		dispatchCoreInput({ kind: "section-controller-resolved" });
	}

	async function dispose(): Promise<void> {
		if (disposed) return;
		disposed = true;
		activeInitToken += 1;
		detachControllerSubscription();
		try {
			unsubscribeFrameworkErrors();
		} catch (error) {
			console.warn(
				"[CoordinatorBridge] framework-error unsubscribe failed:",
				error,
			);
		}
		const cohort = activeCohort;
		activeCohort = null;
		if (cohort) {
			try {
				await coordinator.disposeSectionController({
					sectionId: cohort.sectionId,
					attemptId: cohort.attemptId || undefined,
				});
			} catch (error) {
				console.warn(
					"[CoordinatorBridge] section-controller dispose failed:",
					error,
				);
			}
		}
	}

	return { resolveSectionController, dispose };
}
