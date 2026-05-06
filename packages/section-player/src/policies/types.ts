import type { SectionPlayerReadinessChangeDetail } from "../contracts/public-events.js";

export type SectionPlayerReadinessPolicy = {
	mode: "progressive" | "strict";
};

export type SectionPlayerPreloadPolicy = {
	enabled: boolean;
};

export type SectionPlayerTelemetryPolicy = {
	enabled: boolean;
};

export type SectionPlayerPolicies = {
	readiness: SectionPlayerReadinessPolicy;
	preload: SectionPlayerPreloadPolicy;
	telemetry: SectionPlayerTelemetryPolicy;
};

export interface ReadinessPolicyAdapter {
	computeFinalReady(detail: SectionPlayerReadinessChangeDetail): boolean;
}
