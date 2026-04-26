/**
 * Re-export shim for the canonical stage vocabulary.
 *
 * The contract types and tracker primitive live in
 * `@pie-players/pie-players-shared/pie` so both
 * `<pie-section-player-*>` and `<pie-assessment-toolkit>` import the
 * same source of truth (M6 Phase C).
 */
export {
	STAGES,
	applicableStages,
	stageOrdinal,
} from "@pie-players/pie-players-shared/pie";
export type {
	LoadingCompleteDetail,
	Stage,
	StageChangeDetail,
	StageSourceCe,
	StageStatus,
} from "@pie-players/pie-players-shared/pie";
