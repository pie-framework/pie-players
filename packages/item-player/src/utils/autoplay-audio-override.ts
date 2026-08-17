import type { ConfigEntity } from "@pie-players/pie-players-shared";

export function applyAutoplayAudioOverride(
	configEntity: ConfigEntity,
	override: boolean | undefined,
): ConfigEntity {
	if (override === undefined || !Array.isArray(configEntity?.models)) {
		return configEntity;
	}
	return {
		...configEntity,
		models: configEntity.models.map((model) => ({ ...model, autoplayAudioEnabled: override })),
	};
}
