import { cloneDeep } from "@pie-players/pie-players-shared/object";
import type { SectionPlayerRuntimeConfig } from "@pie-players/pie-section-player";
import type { AssessmentPlayerRuntimeConfig } from "../types.js";

type PlayerConfig = NonNullable<SectionPlayerRuntimeConfig["player"]>;
type BackendConfig = NonNullable<PlayerConfig["backend"]>;

export type ResolveAssessmentSectionPlayerRuntimeArgs = {
	sectionPlayerRuntime?: AssessmentPlayerRuntimeConfig["sectionPlayerRuntime"];
	playerType: "iife" | "esm" | "preloaded";
	attemptId?: string;
	env?: Record<string, unknown> | null;
	coordinator?: unknown;
};

function withDefaultAssignmentId(
	backend: BackendConfig | undefined,
	attemptId: string | undefined,
): BackendConfig | undefined {
	if (!backend?.delivery || backend.delivery.enabled === false || !attemptId) {
		return backend;
	}
	if (backend.delivery.assignmentId !== undefined) {
		return backend;
	}
	return {
		...backend,
		delivery: {
			...backend.delivery,
			assignmentId: attemptId,
		},
	};
}

export function resolveAssessmentSectionPlayerRuntime(
	args: ResolveAssessmentSectionPlayerRuntimeArgs,
): SectionPlayerRuntimeConfig {
	const { sectionPlayerRuntime, playerType, attemptId, env, coordinator } =
		args;
	const player =
		sectionPlayerRuntime?.player &&
		typeof sectionPlayerRuntime.player === "object"
			? {
					...sectionPlayerRuntime.player,
					// A plain deep clone, so the host's object is never retargeted in
					// place. The field-aware cloner this once duplicated exists in the
					// section player only because its merge logic needs the pieces.
					backend: withDefaultAssignmentId(
						sectionPlayerRuntime.player.backend
							? cloneDeep(sectionPlayerRuntime.player.backend)
							: undefined,
						attemptId,
					),
				}
			: sectionPlayerRuntime?.player;
	return {
		playerType,
		...(env ? { env } : {}),
		...(coordinator ? { coordinator } : {}),
		...(sectionPlayerRuntime || {}),
		...(player !== undefined ? { player } : {}),
	};
}
