/**
 * Default TTS tool config for section-demos: AWS Polly via SvelteKit `/api/tts` routes.
 * ToolkitCoordinator otherwise defaults to `backend: "browser"`; merging this into
 * each demo's `tools.providers` aligns playback and the TTS settings panel with Polly.
 */
export const SECTION_DEMOS_DEFAULT_TTS_TOOL_PROVIDER = {
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
