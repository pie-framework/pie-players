import "./components/section-player-splitpane-element";
import "./components/section-player-vertical-element";
import "./components/section-player-tabbed-element";
import "./components/section-player-item-card-element";
import "./components/section-player-passage-card-element";
import "./components/section-player-items-pane-element";
import "./components/section-player-passages-pane-element";
import "./components/section-player-shell-element";
import "./components/section-player-kernel-host-element";

import { setPiePlayersGlobalVersion } from "@pie-players/pie-players-shared";

declare const __PIE_PLAYERS_VERSION__: string;

setPiePlayersGlobalVersion(__PIE_PLAYERS_VERSION__);

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
} from "./contracts/public-events.js";
export { SECTION_PLAYER_PUBLIC_EVENTS } from "./contracts/public-events.js";
export type {
	SectionPlayerRuntimeHostContract,
	SectionPlayerNavigationSnapshot,
	SectionPlayerSnapshot,
} from "./contracts/runtime-host-contract.js";
export {
	SPLITPANE_LAYOUT_CONTRACT,
	TABBED_LAYOUT_CONTRACT,
	VERTICAL_LAYOUT_CONTRACT,
} from "./contracts/layout-parity-metadata.js";
export type {
	ReadinessPolicyAdapter,
	SectionPlayerPolicies,
	SectionPlayerReadinessPolicy,
	SectionPlayerPreloadPolicy,
	SectionPlayerTelemetryPolicy,
} from "./policies/types.js";
export {
	DEFAULT_SECTION_PLAYER_POLICIES,
	isPreloadEnabled,
	isTelemetryEnabled,
} from "./policies/index.js";
export type {
	SectionPlayerCardTitleContext,
	SectionPlayerCardTitleFormatter,
	SectionPlayerItemTitleContext,
	SectionPlayerPassageTitleContext,
} from "./contracts/card-title-formatters.js";
export type { SectionPlayerHostHooks } from "./contracts/host-hooks.js";
