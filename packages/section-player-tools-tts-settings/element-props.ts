import type { CustomProviderDescriptor } from "./types.js";

/**
 * The coordinator calls the panel makes, typed structurally so the published
 * declarations name no toolkit type. A toolkit coordinator satisfies it.
 */
export type ToolkitCoordinatorLike = {
	readonly ttsService?: {
		stop(): void;
		onStateChange(callback: (state: string) => void): () => void;
	};
	getToolConfig(toolId: "textToSpeech"): object | null;
	updateToolConfig(toolId: "textToSpeech", updates: object): void;
	ensureTTSReady(): Promise<void>;
};

/** Inputs shared by the component and its native element declaration. */
export interface TtsSettingsProps {
	toolkitCoordinator?: ToolkitCoordinatorLike | null;
	apiEndpoint?: string;
	storageKey?: string;
	customProviders?: CustomProviderDescriptor[];
}
