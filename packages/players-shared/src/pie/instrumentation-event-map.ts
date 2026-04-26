export type InstrumentationEventMapping = {
	sourceEventName: string;
	instrumentationEventName: string;
};

export const TOOLKIT_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
	// M6 canonical readiness vocabulary. The four-stage canonical list
	// (`composed`, `engine-ready`, `interactive`, `disposed`) is identical
	// across the toolkit CE and the layout CEs — the M6 retro removed the
	// `attached`, `runtime-bound`, and `ui-rendered` stages because they
	// had zero internal or external consumers. Hosts listen for the
	// DOM-prefixed name directly (`pie-stage-change`); the instrumentation
	// bridge forwards the same name to telemetry.
	{
		sourceEventName: "pie-stage-change",
		instrumentationEventName: "pie-toolkit-stage-change",
	},
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
