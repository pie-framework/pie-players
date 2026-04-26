/**
 * Re-export shim for the canonical stage tracker primitive.
 *
 * The implementation lives in `@pie-players/pie-players-shared/pie` so
 * both `<pie-section-player-*>` and `<pie-assessment-toolkit>` use the
 * same tracker (M6 Phase C). New code should import directly from
 * `@pie-players/pie-players-shared/pie`.
 */
export { createStageTracker } from "@pie-players/pie-players-shared/pie";
export type {
	CreateStageTrackerOptions,
	StageTracker,
} from "@pie-players/pie-players-shared/pie";
