import type { TTSToolConfig } from "@pie-players/pie-assessment-toolkit";

const TTS_SETTINGS_STORAGE_PREFIX = "pie:debug-panels:v1";
const TTS_SETTINGS_PANEL_ID = "tts-settings";
const TTS_BACKENDS = new Set<TTSToolConfig["backend"]>([
	"browser",
	"polly",
	"google",
	"server",
]);

type StoredTTSSettings = Partial<TTSToolConfig> & Record<string, unknown>;

export interface SectionDemoTtsSettingsCoordinator {
	getToolConfig(toolId: "textToSpeech"): TTSToolConfig | null;
	updateToolConfig(
		toolId: "textToSpeech",
		updates: Partial<TTSToolConfig>,
	): void;
	ensureTTSReady(config?: TTSToolConfig): Promise<void>;
}

export function createSectionDemoTtsSettingsStorageKey(
	panelPersistenceScope: string,
): string {
	return `${TTS_SETTINGS_STORAGE_PREFIX}:${panelPersistenceScope}:${TTS_SETTINGS_PANEL_ID}`;
}

function readStoredTTSSettings(
	storage: Pick<Storage, "getItem">,
	storageKey: string,
): StoredTTSSettings | null {
	try {
		const raw = storage.getItem(storageKey);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return null;
		}
		const settings = parsed as StoredTTSSettings;
		if (!TTS_BACKENDS.has(settings.backend)) return null;
		return settings;
	} catch {
		return null;
	}
}

function buildCoordinatorUpdate(
	stored: StoredTTSSettings,
): Partial<TTSToolConfig> {
	if (stored.backend !== "browser") {
		return { enabled: true, ...stored };
	}

	// updateToolConfig merges partial updates. Explicitly clear server-only
	// fields that JSON persistence omitted when Browser was originally applied,
	// otherwise the restored config remains polluted by the source server preset.
	return {
		enabled: true,
		...stored,
		backend: "browser",
		provider: undefined,
		serverProvider: undefined,
		apiEndpoint: undefined,
		endpointMode: undefined,
		endpointValidationMode: undefined,
		includeAuthOnAssetFetch: undefined,
		validateEndpoint: undefined,
		cache: undefined,
		speedRate: undefined,
		lang_id: undefined,
	};
}

export async function applyStoredSectionDemoTtsSettings(args: {
	coordinator: SectionDemoTtsSettingsCoordinator;
	storage: Pick<Storage, "getItem">;
	storageKey: string;
}): Promise<boolean> {
	const stored = readStoredTTSSettings(args.storage, args.storageKey);
	if (!stored) return false;

	args.coordinator.updateToolConfig(
		"textToSpeech",
		buildCoordinatorUpdate(stored),
	);
	await args.coordinator.ensureTTSReady(
		args.coordinator.getToolConfig("textToSpeech") ?? undefined,
	);
	return true;
}
