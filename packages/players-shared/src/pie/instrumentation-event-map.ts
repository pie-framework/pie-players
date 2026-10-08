export type InstrumentationEventMapping = {
	sourceEventName: string;
	instrumentationEventName: string;
};

export const TOOLKIT_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] =
	[
		// The toolkit emits no stage events: the section player's runtime
		// engine dispatches `pie-stage-change` on the layout element, above the
		// toolkit, and the section map tracks it there.
		{
			sourceEventName: "runtime-owned",
			instrumentationEventName: "pie-toolkit-runtime-owned",
		},
		{
			sourceEventName: "runtime-inherited",
			instrumentationEventName: "pie-toolkit-runtime-inherited",
		},
		{
			sourceEventName: "runtime-ready",
			instrumentationEventName: "pie-toolkit-runtime-ready",
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

export const SECTION_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] =
	[
		// The runtime engine dispatches `pie-stage-change` and
		// `pie-loading-complete` on the layout element; `framework-error`
		// bubbles to it from the player's toolkit. `session-changed` stays off
		// the bridge for the reason the item map gives below.
		{
			sourceEventName: "pie-stage-change",
			instrumentationEventName: "pie-section-stage-change",
		},
		{
			sourceEventName: "pie-loading-complete",
			instrumentationEventName: "pie-section-loading-complete",
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

export const ITEM_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] = [
	// Only the security signal is mapped, deliberately. The item player's other
	// public events (`load-complete`, `player-error`, `model-updated`,
	// `model-loaded`, `session-changed` and the `backend-*` family) stay off the
	// bridge because `session-changed` carries the learner's responses, and
	// forwarding response data to a host's telemetry provider by default is the
	// host's decision to make rather than this package's default. A host that
	// wants them can attach its own bridge with its own map.
	//
	// `correct-responses-populated` firing at all is the signal: population
	// requires a controller with `createCorrectResponseSession` in the browser,
	// which only a `client-player.js` bundle provides, and the attributes that
	// request it (`add-correct-response`, `env`, `mode`) are all client-mutable.
	{
		sourceEventName: "correct-responses-populated",
		instrumentationEventName: "pie-item-correct-responses-populated",
	},
];

export const ASSESSMENT_INSTRUMENTATION_EVENT_MAP: InstrumentationEventMapping[] =
	[
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
