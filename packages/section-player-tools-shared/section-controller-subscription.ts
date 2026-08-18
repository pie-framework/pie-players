import { isMatchingSectionControllerLifecycleEvent } from "./section-controller.js";
import type { SectionControllerLifecycleEventLike } from "./section-controller.js";

export interface SectionControllerSubscriptionHandlers<TController> {
	/** Look up the current controller for the caller's active sectionId/attemptId. */
	getController: () => TController | null | undefined;
	/** Attach whatever event listeners this caller needs; return their combined teardown. */
	subscribe: (controller: TController) => () => void;
	/** Called once right after a fresh subscribe (not on an already-current target). */
	onSubscribed?: (controller: TController) => void;
	/** Called when no controller is available for the current target. */
	onControllerUnavailable?: () => void;
}

/**
 * Tracks the controller subscription + lifecycle-driven resubscribe queue
 * shared by every debugger panel that follows a section controller across
 * `sectionId`/`attemptId` and coordinator-republish changes. Callers wire
 * this from inside a Svelte `$effect`; see `bindLifecycle`'s doc comment for
 * the untrack requirement from this repo's Svelte Subscription Safety rule.
 */
export function createSectionControllerSubscriptionManager<TController>(
	handlers: SectionControllerSubscriptionHandlers<TController>,
) {
	let unsubscribeController: (() => void) | null = null;
	let unsubscribeLifecycle: (() => void) | null = null;
	let activeSectionId = "";
	let activeAttemptId: string | undefined;
	let resubscribeQueued = false;

	function detachController(): void {
		unsubscribeController?.();
		unsubscribeController = null;
		activeSectionId = "";
		activeAttemptId = undefined;
	}

	function detachLifecycle(): void {
		unsubscribeLifecycle?.();
		unsubscribeLifecycle = null;
	}

	function detachAll(): void {
		detachController();
		detachLifecycle();
	}

	function isActiveTarget(sectionId: string, attemptId?: string): boolean {
		return (
			!!unsubscribeController &&
			activeSectionId === sectionId &&
			activeAttemptId === (attemptId || undefined)
		);
	}

	function ensure(sectionId: string, attemptId?: string): void {
		const controller = handlers.getController();
		if (!controller) {
			detachController();
			handlers.onControllerUnavailable?.();
			return;
		}
		if (isActiveTarget(sectionId, attemptId)) return;
		detachController();
		unsubscribeController = handlers.subscribe(controller);
		activeSectionId = sectionId;
		activeAttemptId = attemptId || undefined;
		handlers.onSubscribed?.(controller);
	}

	function queueEnsure(sectionId: string, attemptId?: string): void {
		if (resubscribeQueued) return;
		resubscribeQueued = true;
		queueMicrotask(() => {
			resubscribeQueued = false;
			ensure(sectionId, attemptId);
		});
	}

	/**
	 * Attach the coordinator's section-controller lifecycle listener. Must be
	 * called from inside `untrack()` within the caller's `$effect` — this
	 * repo's Svelte Subscription Safety rule (see AGENTS.md) forbids reading
	 * or writing reactive state inside a tracked effect body, and both
	 * `ensure`/`queueEnsure` do both.
	 */
	function bindLifecycle(
		coordinator:
			| {
					onSectionControllerLifecycle?: (
						listener: (event: SectionControllerLifecycleEventLike) => void,
					) => () => void;
			  }
			| null
			| undefined,
		sectionId: string,
		attemptId: string | undefined,
		/** Fires for every matching event, in addition to any resubscribe it triggers. */
		onMatchingEvent?: (event: SectionControllerLifecycleEventLike) => void,
	): void {
		detachLifecycle();
		unsubscribeLifecycle =
			coordinator?.onSectionControllerLifecycle?.((event) => {
				if (!isMatchingSectionControllerLifecycleEvent(event, sectionId, attemptId)) {
					return;
				}
				if (event?.type === "disposed") {
					detachController();
					queueEnsure(sectionId, attemptId);
				} else if (!isActiveTarget(sectionId, attemptId)) {
					queueEnsure(sectionId, attemptId);
				}
				onMatchingEvent?.(event);
			}) || null;
	}

	return {
		ensure,
		queueEnsure,
		isActiveTarget,
		bindLifecycle,
		detachController,
		detachLifecycle,
		detachAll,
	};
}
