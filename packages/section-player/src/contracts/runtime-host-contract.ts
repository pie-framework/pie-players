import type {
	SectionPlayerReadinessChangeDetail,
} from "./public-events.js";
import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";

export type SectionPlayerNavigationSnapshot = {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	currentItemId?: string;
};

export type SectionPlayerSnapshot = {
	readiness: SectionPlayerReadinessChangeDetail;
	composition: {
		itemsCount: number;
		passagesCount: number;
	};
	navigation: SectionPlayerNavigationSnapshot;
};

export interface SectionPlayerRuntimeHostContract {
	getSnapshot(): SectionPlayerSnapshot;
	selectComposition(): SectionPlayerSnapshot["composition"];
	selectNavigation(): SectionPlayerNavigationSnapshot;
	selectReadiness(): SectionPlayerReadinessChangeDetail;
	navigateTo(index: number): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	getSectionController(): SectionControllerHandle | null;
	waitForSectionController(
		timeoutMs?: number,
	): Promise<SectionControllerHandle | null>;
	/**
	 * Move focus into this section player for a host-owned moment the
	 * framework cannot observe (e.g. a Skip-to-Main button in the host
	 * ribbon). Returns `true` if focus moved.
	 *
	 * Honors `SectionPlayerFocusPolicy.autoFocus`:
	 * - `"start-of-content"` (default): passage card when present, else the
	 *   first item card.
	 * - `"current-item"`: the item card currently marked `is-current`.
	 * - `"none"`: falls back to `"start-of-content"` — hosts call
	 *   `focusStart()` precisely because they do want focus to move.
	 */
	focusStart(): boolean;
}
