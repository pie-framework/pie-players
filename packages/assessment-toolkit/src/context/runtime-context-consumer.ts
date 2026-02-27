import { ContextConsumer } from "@pie-players/pie-context";
import type { UnknownContext } from "@pie-players/pie-context";
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

type ContextProviderLikeEvent = Event & {
	context?: unknown;
};

function connectConsumerWithProviderRetry<T extends UnknownContext>(
	host: HTMLElement,
	context: T,
	onValue: (value: unknown) => void,
): () => void {
	let hasValue = false;
	const consumer = new ContextConsumer(host, {
		context,
		subscribe: true,
		onValue: (value) => {
			hasValue = true;
			onValue(value);
		},
	});
	consumer.connect();

	const onContextProvider = (event: ContextProviderLikeEvent) => {
		if (event.context !== context) return;
		consumer.requestValue();
	};
	host.addEventListener("context-provider", onContextProvider);

	let attempts = 0;
	const maxAttempts = 200;
	const retryTimer = globalThis.setInterval(() => {
		if (hasValue || attempts >= maxAttempts) {
			globalThis.clearInterval(retryTimer);
			return;
		}
		attempts += 1;
		consumer.requestValue();
	}, 50);

	return () => {
		globalThis.clearInterval(retryTimer);
		host.removeEventListener("context-provider", onContextProvider);
		consumer.disconnect();
	};
}

/**
 * Connect a DOM host element to the shared assessment toolkit runtime context.
 * Returns a cleanup function that disconnects the underlying consumer.
 */
export function connectAssessmentToolkitRuntimeContext(
	host: HTMLElement,
	onValue: RuntimeContextListener,
): () => void {
	return connectConsumerWithProviderRetry(
		host,
		assessmentToolkitRuntimeContext,
		onValue as (value: unknown) => void,
	);
}

export function connectAssessmentToolkitHostRuntimeContext(
	host: HTMLElement,
	onValue: HostRuntimeContextListener,
): () => void {
	return connectConsumerWithProviderRetry(
		host,
		assessmentToolkitHostRuntimeContext,
		onValue as (value: unknown) => void,
	);
}

export function connectAssessmentToolkitShellContext(
	host: HTMLElement,
	onValue: ShellContextListener,
): () => void {
	return connectConsumerWithProviderRetry(
		host,
		assessmentToolkitShellContext,
		onValue as (value: unknown) => void,
	);
}

export function connectAssessmentToolkitRegionScopeContext(
	host: HTMLElement,
	onValue: RegionScopeContextListener,
): () => void {
	return connectConsumerWithProviderRetry(
		host,
		assessmentToolkitRegionScopeContext,
		onValue as (value: unknown) => void,
	);
}
