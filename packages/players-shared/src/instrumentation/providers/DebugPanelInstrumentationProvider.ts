import {
	createErrorDebugRecord,
	createEventDebugRecord,
	createMetricDebugRecord,
	emitInstrumentationDebugRecord,
} from "../debug-panel-stream.js";
import type { ErrorAttributes, InstrumentationConfig } from "../types.js";
import { BaseInstrumentationProvider } from "./BaseInstrumentationProvider.js";

export class DebugPanelInstrumentationProvider extends BaseInstrumentationProvider {
	readonly providerId = "debug-panel";
	readonly providerName = "Debug Panel";

	async initialize(config?: InstrumentationConfig): Promise<void> {
		this.config = config;
		this.initialized = true;
	}

	isReady(): boolean {
		return this.initialized;
	}

	destroy(): void {
		this.initialized = false;
	}

	protected doTrackError(error: Error, attributes: Record<string, any>): void {
		emitInstrumentationDebugRecord(
			createErrorDebugRecord({
				providerId: this.providerId,
				providerName: this.providerName,
				error,
				attributes: attributes as ErrorAttributes,
			}),
		);
	}

	protected doTrackEvent(
		eventName: string,
		attributes: Record<string, any>,
	): void {
		emitInstrumentationDebugRecord(
			createEventDebugRecord({
				providerId: this.providerId,
				providerName: this.providerName,
				eventName,
				attributes,
			}),
		);
		if (!eventName.startsWith("metric:")) {
			return;
		}
		const rawMetricValue = attributes.metricValue;
		if (typeof rawMetricValue !== "number" || !Number.isFinite(rawMetricValue)) {
			return;
		}
		const metricName =
			typeof attributes.metricName === "string" && attributes.metricName
				? attributes.metricName
				: eventName.replace(/^metric:/, "");
		emitInstrumentationDebugRecord(
			createMetricDebugRecord({
				providerId: this.providerId,
				providerName: this.providerName,
				metricName,
				value: rawMetricValue,
				attributes,
			}),
		);
	}

	protected doSetUserContext(
		userId: string,
		attributes?: Record<string, any>,
	): void {
		emitInstrumentationDebugRecord({
			kind: "user-context",
			providerId: this.providerId,
			providerName: this.providerName,
			name: userId,
			timestamp: new Date().toISOString(),
			attributes: attributes
				? { ...(attributes as Record<string, unknown>) }
				: undefined,
		});
	}

	protected doSetGlobalAttributes(attributes: Record<string, any>): void {
		emitInstrumentationDebugRecord({
			kind: "global-attributes",
			providerId: this.providerId,
			providerName: this.providerName,
			name: "set-global-attributes",
			timestamp: new Date().toISOString(),
			attributes: { ...(attributes as Record<string, unknown>) },
		});
	}
}
