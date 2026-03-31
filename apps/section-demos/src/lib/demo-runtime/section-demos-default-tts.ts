/**
 * Optional AWS Polly transport via local `/api/tts` proxy.
 * Keep available for targeted comparisons in specific demos.
 */
export const SECTION_DEMOS_POLLY_TTS_TOOL_PROVIDER = {
	enabled: true,
	backend: "polly" as const,
	serverProvider: "polly" as const,
	apiEndpoint: "/api/tts",
	transportMode: "pie" as const,
	endpointMode: "synthesizePath" as const,
	endpointValidationMode: "voices" as const,
	defaultVoice: "Joanna",
	language: "en-US",
	rate: 1,
	engine: "neural" as const,
	sampleRate: 24000,
	format: "mp3" as const,
	speechMarksMode: "word" as const,
};

/**
 * SchoolCity-style custom transport via local server proxy.
 * Secrets stay server-side in `/api/tts/sc`.
 */
export const SECTION_DEMOS_SC_TTS_TOOL_PROVIDER = {
	enabled: true,
	backend: "server" as const,
	serverProvider: "custom" as const,
	transportMode: "custom" as const,
	endpointMode: "rootPost" as const,
	endpointValidationMode: "none" as const,
	apiEndpoint: "/api/tts/sc",
	lang_id: "en-US" as const,
	speedRate: "medium" as const,
	cache: true,
	// Keep auth server-side; asset URLs are expected to be public CloudFront links.
	includeAuthOnAssetFetch: false,
};

/**
 * Default for section demos and downstream hosts (including Pieoneer):
 * SchoolCity-style transport through the local `/api/tts/sc` proxy.
 */
export const SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER = {
	...SECTION_DEMOS_SC_TTS_TOOL_PROVIDER,
} as const;
