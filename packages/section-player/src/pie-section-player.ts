import "./components/section-player-splitpane-element";
import "./components/section-player-vertical-element";
import "./components/section-player-item-card-element";
import "./components/section-player-passage-card-element";
import "./components/section-player-items-pane-element";
import "./components/section-player-passages-pane-element";
import "./components/section-player-shell-element";
import "./components/section-player-kernel-host-element";

export type {
	SectionPlayerLayoutContract,
	SectionPlayerLayoutName,
	SectionPlayerLayoutCapability,
	SectionPlayerBasicPropName,
	SectionPlayerAdvancedPropName,
	SectionPlayerLayoutPropName,
	SectionPlayerLayoutCommandName,
} from "./contracts/layout-contract.js";
export type {
	SectionPlayerPublicEventName,
	SectionPlayerReadinessPhase,
	SectionPlayerReadinessChangeDetail,
	SectionPlayerControllerReadyDetail,
} from "./contracts/public-events.js";
export { SECTION_PLAYER_PUBLIC_EVENTS } from "./contracts/public-events.js";
export type {
	SectionPlayerRuntimeHostContract,
	SectionPlayerNavigationSnapshot,
	SectionPlayerSnapshot,
} from "./contracts/runtime-host-contract.js";
export {
	SPLITPANE_LAYOUT_CONTRACT,
	VERTICAL_LAYOUT_CONTRACT,
} from "./contracts/layout-parity-metadata.js";
export type {
	ReadinessPolicyAdapter,
	SectionPlayerPolicies,
	SectionPlayerReadinessPolicy,
	SectionPlayerPreloadPolicy,
	SectionPlayerFocusPolicy,
	SectionPlayerTelemetryPolicy,
} from "./policies/types.js";
export { DEFAULT_SECTION_PLAYER_POLICIES } from "./policies/index.js";
