import { cloneDeep } from "@pie-players/pie-players-shared/object";
import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";
import type { AssessmentPlayerRuntimeConfig } from "../types.js";

export type ResolveAssessmentSectionPlayerRuntimeArgs = {
	sectionPlayerRuntime?: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"];
	playerType: "iife" | "esm" | "preloaded";
	assessmentId?: string;
	env?: Record<string, unknown> | null;
	coordinator?: unknown;
};

export function resolveAssessmentSectionPlayerRuntime(
	args: ResolveAssessmentSectionPlayerRuntimeArgs,
): SectionPlayerRuntimeConfig {
	const {
		sectionPlayerRuntime,
		playerType,
		assessmentId,
		env,
		coordinator,
	} = args;
	const player =
		sectionPlayerRuntime?.player &&
		typeof sectionPlayerRuntime.player === "object"
			? {
					...sectionPlayerRuntime.player,
					// A plain deep clone, so the host's object is never retargeted in
					// place. The field-aware cloner this once duplicated exists in the
					// section player only because its merge logic needs the pieces.
					backend: sectionPlayerRuntime.player.backend
						? cloneDeep(sectionPlayerRuntime.player.backend)
						: undefined,
				}
			: sectionPlayerRuntime?.player;
	return {
		playerType,
		...(assessmentId ? { assessmentId } : {}),
		...(env ? { env } : {}),
		...(coordinator ? { coordinator } : {}),
		...(sectionPlayerRuntime || {}),
		...(player !== undefined ? { player } : {}),
	};
}
