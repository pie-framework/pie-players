import type { UnknownContext } from "@pie-players/pie-context";
import {
	connectAssessmentToolkitRegionScopeContext,
	connectAssessmentToolkitRuntimeContext,
	connectAssessmentToolkitShellContext,
	type RegionScopeContextListener,
	type RuntimeContextListener,
	type ShellContextListener,
} from "../context/runtime-context-consumer.js";

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
 * Uses retry + provider announcements so late providers are tolerated.
 */
export function connectToolRuntimeContext(
	host: HTMLElement,
	onValue: RuntimeContextListener,
): () => void {
	return connectAssessmentToolkitRuntimeContext(host, onValue);
}

/**
 * Shared shell-context connection contract for tools needing item/passage scope.
 */
export function connectToolShellContext(
	host: HTMLElement,
	onValue: ShellContextListener,
): () => void {
	return connectAssessmentToolkitShellContext(host, onValue);
}

/**
 * Shared region-scope context contract for tools targeting content subregions.
 */
export function connectToolRegionScopeContext(
	host: HTMLElement,
	onValue: RegionScopeContextListener,
): () => void {
	return connectAssessmentToolkitRegionScopeContext(host, onValue);
}

/**
 * Guard utility: narrows unknown context payloads when needed by callers.
 */
export function isContextValueDefined<T extends UnknownContext>(
	value: unknown,
): value is T["__context__"] {
	return value !== null && value !== undefined;
}
