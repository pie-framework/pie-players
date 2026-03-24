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
		sourceEventName: "runtime-error",
		instrumentationEventName: "pie-toolkit-runtime-error",
	},
];

export const SECTION_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
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
