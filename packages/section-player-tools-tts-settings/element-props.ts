import type { ToolkitCoordinatorApi } from "@pie-players/pie-assessment-toolkit";
import type { CustomProviderDescriptor } from "./types.js";

/** Inputs shared by the component and its native element declaration. */
export interface TtsSettingsProps {
	toolkitCoordinator?: ToolkitCoordinatorApi | null;
	apiEndpoint?: string;
	storageKey?: string;
	customProviders?: CustomProviderDescriptor[];
}
