export type InstrumentationEventMapping = {
	sourceEventName: string;
	instrumentationEventName: string;
};

export const TOOLKIT_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
	{
		sourceEventName: "runtime-owned",
		instrumentationEventName: "pie-toolkit-runtime-owned",
	},
	{
		sourceEventName: "runtime-inherited",
		instrumentationEventName: "pie-toolkit-runtime-inherited",
	},
	{
		sourceEventName: "toolkit-ready",
		instrumentationEventName: "pie-toolkit-ready",
	},
	{
		sourceEventName: "section-ready",
		instrumentationEventName: "pie-toolkit-section-ready",
	},
	{
		sourceEventName: "framework-error",
		instrumentationEventName: "pie-toolkit-framework-error",
	},
	// Deprecated source alias for `framework-error`. Telemetry kept so hosts
	// that still listen to `runtime-error` see no telemetry regression while
	// they migrate to `framework-error`.
	{
		sourceEventName: "runtime-error",
		instrumentationEventName: "pie-toolkit-runtime-error",
	},
];

export const SECTION_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
	// M6 canonical readiness vocabulary. Hosts listen for the DOM-prefixed
	// names directly (`pie-stage-change`, `pie-loading-complete`); the
	// instrumentation bridge forwards the same names to telemetry. Legacy
	// readiness mappings below stay in place during the deprecation window
	// so existing telemetry pipelines see no regression.
	{
		sourceEventName: "pie-stage-change",
		instrumentationEventName: "pie-section-stage-change",
	},
	{
		sourceEventName: "pie-loading-complete",
		instrumentationEventName: "pie-section-loading-complete",
	},
	{
		sourceEventName: "readiness-change",
		instrumentationEventName: "pie-section-readiness-change",
	},
	{
		sourceEventName: "interaction-ready",
		instrumentationEventName: "pie-section-interaction-ready",
	},
	{
		sourceEventName: "ready",
		instrumentationEventName: "pie-section-ready",
	},
	{
		sourceEventName: "section-controller-ready",
		instrumentationEventName: "pie-section-controller-ready",
	},
	{
		sourceEventName: "session-changed",
		instrumentationEventName: "pie-section-session-changed",
	},
	{
		sourceEventName: "composition-changed",
		instrumentationEventName: "pie-section-composition-changed",
	},
	{
		sourceEventName: "framework-error",
		instrumentationEventName: "pie-section-framework-error",
	},
	// Deprecated source alias for `framework-error`. Telemetry kept so hosts
	// that still listen to `runtime-error` see no telemetry regression while
	// they migrate to `framework-error`.
	{
		sourceEventName: "runtime-error",
		instrumentationEventName: "pie-section-runtime-error",
	},
	{
		sourceEventName: "element-preload-retry",
		instrumentationEventName: "pie-section-element-preload-retry",
	},
	{
		sourceEventName: "element-preload-error",
		instrumentationEventName: "pie-section-element-preload-error",
	},
];

export const ASSESSMENT_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
	{
		sourceEventName: "assessment-controller-ready",
		instrumentationEventName: "pie-assessment-controller-ready",
	},
	{
		sourceEventName: "assessment-navigation-requested",
		instrumentationEventName: "pie-assessment-navigation-requested",
	},
	{
		sourceEventName: "assessment-route-changed",
		instrumentationEventName: "pie-assessment-route-changed",
	},
	{
		sourceEventName: "assessment-session-applied",
		instrumentationEventName: "pie-assessment-session-applied",
	},
	{
		sourceEventName: "assessment-session-changed",
		instrumentationEventName: "pie-assessment-session-changed",
	},
	{
		sourceEventName: "assessment-progress-changed",
		instrumentationEventName: "pie-assessment-progress-changed",
	},
	{
		sourceEventName: "assessment-submission-state-changed",
		instrumentationEventName: "pie-assessment-submission-state-changed",
	},
	{
		sourceEventName: "assessment-error",
		instrumentationEventName: "pie-assessment-error",
	},
];
