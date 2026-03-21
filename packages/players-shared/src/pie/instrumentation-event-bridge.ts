import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import type { InstrumentationEventMapping } from "./instrumentation-event-map.js";
import { createPieLogger, isGlobalDebugEnabled } from "./logger.js";

const logger = createPieLogger("instrumentation-event-bridge", () =>
	isGlobalDebugEnabled(),
);

export type AttachInstrumentationEventBridgeArgs = {
	host: EventTarget | null | undefined;
	instrumentationProvider?: unknown;
	component: string;
	eventMap: InstrumentationEventMapping[];
	staticAttributes?: Record<string, unknown>;
	debug?: boolean;
	dedupeWindowMs?: number;
	shouldTrackEvent?: (event: Event) => boolean;
};

function normalizeEventDetail(detail: unknown): Record<string, unknown> {
	if (detail && typeof detail === "object") {
		return detail as Record<string, unknown>;
	}
	if (typeof detail === "undefined") {
		return {};
	}
	return { value: detail };
}

function warnInvalidProvider(component: string): void {
	logger.warn(
		`[InstrumentationEventBridge:${component}] Ignoring invalid instrumentation provider; expected InstrumentationProvider contract`,
	);
}

function trackBridgeError(args: {
	provider: InstrumentationProvider;
	component: string;
	error: unknown;
	sourceEventName: string;
}): void {
	try {
		args.provider.trackError(
			args.error instanceof Error
				? args.error
				: new Error(String(args.error ?? "Unknown instrumentation bridge error")),
			{
				component: args.component,
				errorType: "InstrumentationBridgeError",
				sourceEventName: args.sourceEventName,
			},
		);
	} catch {
		// Avoid recursive failures while reporting instrumentation bridge errors.
	}
}

export function attachInstrumentationEventBridge(
	args: AttachInstrumentationEventBridgeArgs,
): () => void {
	if (!args.host || !args.eventMap.length) return () => {};
	if (!args.instrumentationProvider) return () => {};
	if (!isInstrumentationProvider(args.instrumentationProvider)) {
		if (args.debug) {
			warnInvalidProvider(args.component);
		}
		return () => {};
	}

	const provider = args.instrumentationProvider;
	const removeListeners: Array<() => void> = [];
	const dedupeWindowMs = Math.max(0, args.dedupeWindowMs ?? 0);
	const recentEventMap = new Map<string, number>();

	const computeDedupeKey = (
		mapping: InstrumentationEventMapping,
		detail: Record<string, unknown>,
	): string => {
		const summary = [
			detail.assessmentId,
			detail.sectionId,
			detail.attemptId,
			detail.itemId,
			detail.canonicalItemId,
			detail.sourceRuntimeId,
		]
			.map((value) => String(value ?? ""))
			.join("|");
		return `${mapping.instrumentationEventName}|${summary}`;
	};

	for (const mapping of args.eventMap) {
		const handler = (event: Event) => {
			try {
				if (!provider.isReady()) return;
				if (args.shouldTrackEvent && !args.shouldTrackEvent(event)) return;
				const customEvent = event as CustomEvent<unknown>;
				const detail = normalizeEventDetail(customEvent.detail);
				const timestamp = new Date().toISOString();
				const mergedAttributes = {
					...detail,
					...args.staticAttributes,
					component: args.component,
					sourceEventName: mapping.sourceEventName,
					timestamp,
				};
				if (dedupeWindowMs > 0) {
					const now = Date.now();
					const dedupeKey = computeDedupeKey(mapping, mergedAttributes);
					const previousTimestamp = recentEventMap.get(dedupeKey);
					if (
						typeof previousTimestamp === "number" &&
						now - previousTimestamp < dedupeWindowMs
					) {
						return;
					}
					recentEventMap.set(dedupeKey, now);
				}
				provider.trackEvent(mapping.instrumentationEventName, {
					...mergedAttributes,
				});
			} catch (error) {
				trackBridgeError({
					provider,
					component: args.component,
					error,
					sourceEventName: mapping.sourceEventName,
				});
			}
		};

		args.host.addEventListener(mapping.sourceEventName, handler as EventListener);
		removeListeners.push(() => {
			args.host?.removeEventListener(mapping.sourceEventName, handler as EventListener);
		});
	}

	return () => {
		for (const removeListener of removeListeners) {
			removeListener();
		}
	};
}
