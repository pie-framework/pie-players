import { ContextConsumer } from "@pie-players/pie-context";
import {
	assessmentToolkitRuntimeContext,
	type AssessmentToolkitRuntimeContext,
} from "./assessment-toolkit-context.js";

export type RuntimeContextListener = (
	value: AssessmentToolkitRuntimeContext,
) => void;

/**
 * Connect a DOM host element to the shared assessment toolkit runtime context.
 * Returns a cleanup function that disconnects the underlying consumer.
 */
export function connectAssessmentToolkitRuntimeContext(
	host: HTMLElement,
	onValue: RuntimeContextListener,
): () => void {
	const consumer = new ContextConsumer(host, {
		context: assessmentToolkitRuntimeContext,
		subscribe: true,
		onValue,
	});
	consumer.connect();
	return () => {
		consumer.disconnect();
	};
}
