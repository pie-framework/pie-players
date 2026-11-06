export type SectionPlayerReadinessPolicy = {
	mode: "progressive" | "strict";
};

export type SectionPlayerPreloadPolicy = {
	enabled: boolean;
};

export type SectionPlayerTelemetryPolicy = {
	enabled: boolean;
};

/**
 * Whether item cards under item session control render the Check answer /
 * Try again button. A host with its own submit flow turns it off and calls the
 * controller's
 * `checkItem` and `retryItem`; the status line stays.
 */
export type SectionPlayerCheckControlPolicy = {
	enabled: boolean;
};

export type SectionPlayerPolicies = {
	readiness: SectionPlayerReadinessPolicy;
	preload: SectionPlayerPreloadPolicy;
	telemetry: SectionPlayerTelemetryPolicy;
	checkControl: SectionPlayerCheckControlPolicy;
};
