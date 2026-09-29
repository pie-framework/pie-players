import { connectContextWithRetry } from "@pie-players/pie-context";
import {
	assessmentToolkitHostRuntimeContext,
	assessmentToolkitRegionScopeContext,
	assessmentToolkitShellContext,
	assessmentToolkitRuntimeContext,
	type AssessmentToolkitHostRuntimeContext,
	type AssessmentToolkitRegionScopeContext,
	type AssessmentToolkitShellContext,
	type AssessmentToolkitRuntimeContext,
} from "./assessment-toolkit-context.js";

export type RuntimeContextListener = (
	value: AssessmentToolkitRuntimeContext,
) => void;
export type HostRuntimeContextListener = (
	value: AssessmentToolkitHostRuntimeContext,
) => void;
export type ShellContextListener = (
	value: AssessmentToolkitShellContext,
) => void;
export type RegionScopeContextListener = (
	value: AssessmentToolkitRegionScopeContext,
) => void;

/**
 * Connect a DOM host element to the shared assessment toolkit runtime context.
 * Returns a cleanup function that disconnects the underlying consumer.
 */
export function connectAssessmentToolkitRuntimeContext(
	host: HTMLElement,
	onValue: RuntimeContextListener,
): () => void {
	return connectContextWithRetry(
		host,
		assessmentToolkitRuntimeContext,
		onValue,
	);
}

export function connectAssessmentToolkitHostRuntimeContext(
	host: HTMLElement,
	onValue: HostRuntimeContextListener,
): () => void {
	return connectContextWithRetry(
		host,
		assessmentToolkitHostRuntimeContext,
		onValue,
	);
}

export function connectAssessmentToolkitShellContext(
	host: HTMLElement,
	onValue: ShellContextListener,
): () => void {
	return connectContextWithRetry(host, assessmentToolkitShellContext, onValue);
}

export function connectAssessmentToolkitRegionScopeContext(
	host: HTMLElement,
	onValue: RegionScopeContextListener,
): () => void {
	return connectContextWithRetry(
		host,
		assessmentToolkitRegionScopeContext,
		onValue,
	);
}
