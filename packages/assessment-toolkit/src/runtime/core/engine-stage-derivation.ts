/**
 * Stage derivation for the section runtime engine (M7).
 *
 * Maps the FSM phase onto the canonical M6 stage vocabulary
 * (`composed`, `engine-ready`, `interactive`, `disposed`). The phase
 * `idle` is the engine's "no cohort yet" state and has no stage; it
 * returns `null`.
 *
 * This module exists as a one-line indirection because:
 *   - The adapter uses it to guard `pie-stage-change` emit calls.
 *   - The transition uses it (via the pure helper below) to decide
 *     when to emit `stage-change` outputs as the phase advances.
 *   - Future shape-specific stages (e.g. layout-only `paginated`) can
 *     be wired in here without rewriting callers.
 */

import type { Stage } from "@pie-players/pie-players-shared/pie";
import type { SectionEnginePhase } from "./engine-state.js";

export function phaseToStage(phase: SectionEnginePhase): Stage | null {
	switch (phase) {
		case "idle":
			return null;
		case "booting-section":
			return "composed";
		case "engine-ready":
			return "engine-ready";
		case "interactive":
			return "interactive";
		case "disposed":
			return "disposed";
	}
}
