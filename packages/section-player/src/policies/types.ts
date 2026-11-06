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
 * Whether formative item cards render the Check answer / Try again button. A
 * host with its own submit flow turns it off and calls the controller's
 * `checkFormativeItem` and `retryFormativeItem`; the status line stays.
 */
export type SectionPlayerFormativeControlPolicy = {
	enabled: boolean;
};

export type SectionPlayerPolicies = {
	readiness: SectionPlayerReadinessPolicy;
	preload: SectionPlayerPreloadPolicy;
	telemetry: SectionPlayerTelemetryPolicy;
	formativeControl: SectionPlayerFormativeControlPolicy;
};
