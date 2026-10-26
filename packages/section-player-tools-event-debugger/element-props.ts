export type ControllerEvent = {
	type?: string;
	timestamp?: number;
	itemId?: string;
	canonicalItemId?: string;
	intent?: string;
	[key: string]: unknown;
};

export type ToolkitCoordinatorLike = {
	// The subscribe* helpers follow the toolkit's active section cohort
	// automatically and do not accept sectionId / attemptId arguments. The
	// debugger keeps `sectionId` + `attemptId` in the shared subscription
	// manager purely to gate same-target re-subscribe — it does not pass
	// them to the coordinator.
	subscribeItemEvents?: (args: {
		listener: (event: ControllerEvent) => void;
	}) => () => void;
	subscribeSectionLifecycleEvents?: (args: {
		listener: (event: ControllerEvent) => void;
	}) => () => void;
	getSectionController?: (args: {
		sectionId: string;
		attemptId?: string;
	}) => unknown;
	onSectionControllerLifecycle?: (
		listener: (event: {
			key?: { sectionId?: string; attemptId?: string };
		}) => void,
	) => () => void;
};

export type EventLevel = "item" | "section";

export type EventLimitOverrides = Partial<Record<EventLevel, number>>;

/** Inputs shared by the component and its native element declaration. */
export interface EventDebuggerProps {
	maxEvents?: number;
	maxEventsByLevel?: EventLimitOverrides;
	toolkitCoordinator?: ToolkitCoordinatorLike | null;
	sectionId?: string;
	attemptId?: string;
	persistenceScope?: string;
	persistencePanelId?: string;
}
