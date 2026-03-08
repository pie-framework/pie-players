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
}
