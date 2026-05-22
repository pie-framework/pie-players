export declare const PanelWindowControls: any;
export declare const PanelResizeHandle: any;
export declare const SharedFloatingPanel: any;
export declare const SessionDbPanel: any;
export declare const DebugPanelToggles: any;
export {
	createFloatingPanelPointerController,
	computePanelSizeFromViewport,
	claimNextFloatingPanelZIndex,
	type FloatingPanelPointerController,
	type FloatingPanelState,
	type FloatingPanelViewportSizing,
} from "./floating-panel.js";
export {
	getSectionControllerFromCoordinator,
	isMatchingSectionControllerLifecycleEvent,
	optionalIdsEqual,
	type SectionControllerLifecycleEventLike,
	type SectionControllerKeyLike,
	type ToolkitCoordinatorWithSectionController,
} from "./section-controller.js";
