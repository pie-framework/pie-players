import { connectContextWithRetry } from "@pie-players/pie-context";
import {
	assessmentToolkitHostRuntimeContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitRuntimeContext,
	assessmentToolkitShellContext,
	type AssessmentToolkitHostRuntimeContext,
	type AssessmentToolkitRegionScopeContext,
	type AssessmentToolkitRuntimeContext,
	type AssessmentToolkitShellContext,
} from "../context/assessment-toolkit-context.js";
import type { ZIndexLayer } from "../services/ToolCoordinator.js";
import type { ToolCoordinatorApi } from "../services/interfaces.js";

type BaseEventInit = Pick<EventInit, "bubbles" | "composed" | "cancelable">;

const CROSS_BOUNDARY_EVENT_INIT: BaseEventInit = {
	bubbles: true,
	composed: true,
	cancelable: false,
};

/**
 * Contract helper for all toolkit/tool events that must cross custom-element boundaries.
 */
export function createCrossBoundaryEvent<T>(
	name: string,
	detail: T,
	init: Partial<BaseEventInit> = {},
): CustomEvent<T> {
	return new CustomEvent<T>(name, {
		detail,
		...CROSS_BOUNDARY_EVENT_INIT,
		...init,
	});
}

/**
 * Dispatches a cross-boundary event with toolkit defaults.
 */
export function dispatchCrossBoundaryEvent<T>(
	target: EventTarget,
	name: string,
	detail: T,
	init: Partial<BaseEventInit> = {},
): boolean {
	return target.dispatchEvent(createCrossBoundaryEvent(name, detail, init));
}

/**
 * Shared runtime-context connection contract for tools and shells.
 * A provider that connects after the tool answers it through the document's
 * context root.
 */
export function connectToolRuntimeContext(
	host: HTMLElement,
	onValue: (value: AssessmentToolkitRuntimeContext) => void,
): () => void {
	return connectContextWithRetry(host, assessmentToolkitRuntimeContext, onValue);
}

/**
 * Shared shell-context connection contract for tools needing item/passage scope.
 */
export function connectToolShellContext(
	host: HTMLElement,
	onValue: (value: AssessmentToolkitShellContext) => void,
): () => void {
	return connectContextWithRetry(host, assessmentToolkitShellContext, onValue);
}

/**
 * Shared region-scope context contract for tools targeting content subregions.
 */
export function connectToolRegionScopeContext(
	host: HTMLElement,
	onValue: (value: AssessmentToolkitRegionScopeContext) => void,
): () => void {
	return connectContextWithRetry(
		host,
		assessmentToolkitRegionScopeContext,
		onValue,
	);
}

/** Connects a shell or toolkit element to the host runtime context above it. */
export function connectHostRuntimeContext(
	host: HTMLElement,
	onValue: (value: AssessmentToolkitHostRuntimeContext) => void,
): () => void {
	return connectContextWithRetry(
		host,
		assessmentToolkitHostRuntimeContext,
		onValue,
	);
}

/** A tool's registration with the coordinator in its runtime context. */
export interface ToolCoordinatorRegistration {
	/**
	 * Registers `toolId` with `coordinator`, first unregistering it from the
	 * coordinator or id it was registered under. The coordinator arrives through
	 * a republished runtime context, so a new instance can replace the old one
	 * mid-session; a one-shot registration would leave z-index, `bringToFront`
	 * and visibility-restore bound to the dead one. Call it from an effect on
	 * both; it does nothing until both are set, or when neither changed.
	 */
	sync(
		coordinator: ToolCoordinatorApi | null | undefined,
		toolId: string | null | undefined,
	): void;
	/**
	 * Unregisters from the coordinator the registration was made against, which
	 * is not necessarily the one currently in context.
	 */
	release(): void;
}

export function createToolCoordinatorRegistration(
	name: string,
	layer: ZIndexLayer,
): ToolCoordinatorRegistration {
	let registered: { coordinator: ToolCoordinatorApi; toolId: string } | null =
		null;

	function release() {
		registered?.coordinator.unregisterTool(registered.toolId);
		registered = null;
	}

	return {
		sync(coordinator, toolId) {
			if (!coordinator || !toolId) return;
			if (
				registered?.coordinator === coordinator &&
				registered.toolId === toolId
			) {
				return;
			}
			release();
			coordinator.registerTool(toolId, name, undefined, layer);
			registered = { coordinator, toolId };
		},
		release,
	};
}
