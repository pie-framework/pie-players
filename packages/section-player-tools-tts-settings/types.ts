/**
 * The contract a host's `customProviders` entries implement. Type-only: the
 * panel bundle exports no runtime values.
 */

export type PreviewMode = "plain" | "ssml";

/** One word's timing in preview audio: `time` from the audio start, `start`/`end` offsets into the tracked text. */
export type PreviewSpeechMark = {
	time: number;
	start: number;
	end: number;
	value?: string;
};

/** What a provider's `preview` returns for the panel to play and track. */
export type CustomProviderPreviewResult = {
	audioUrl?: string;
	speechMarks?: PreviewSpeechMark[];
	/** The text the speech marks index into, when it differs from the preview text. */
	trackingText?: string;
};

export type ProviderAvailabilityResult = {
	available: boolean;
	message?: string | null;
	detail?: string | null;
};

export type ProviderApplyResult = {
	/** The `textToSpeech` tool config the provider's tab applies. */
	config: Record<string, unknown>;
};

/** What the panel passes to each provider hook. */
export type CustomProviderContext = {
	id: string;
	apiEndpoint: string;
	state: Record<string, unknown>;
	previewText?: string;
	previewMode?: PreviewMode;
};

/** A provider tab beyond Browser, Polly and Google. */
export type CustomProviderDescriptor = {
	/** Unique; `browser`, `polly` and `google` are reserved. */
	id: string;
	label: string;
	description?: string;
	checkAvailability?: (
		context: CustomProviderContext,
	) => ProviderAvailabilityResult | Promise<ProviderAvailabilityResult>;
	buildApplyConfig: (
		context: CustomProviderContext,
	) => ProviderApplyResult | Promise<ProviderApplyResult>;
	preview?: (
		context: CustomProviderContext,
	) => Promise<void | CustomProviderPreviewResult>;
	initialState?: Record<string, unknown>;
};
