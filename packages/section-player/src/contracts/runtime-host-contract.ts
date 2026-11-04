import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";

export type SectionPlayerNavigationSnapshot = {
	currentIndex: number;
	totalItems: number;
	canNext: boolean;
	canPrevious: boolean;
	currentItemId?: string;
};

export type SectionPlayerSnapshot = {
	composition: {
		itemsCount: number;
		passagesCount: number;
	};
	navigation: SectionPlayerNavigationSnapshot;
};

export interface SectionPlayerRuntimeHostContract {
	getSnapshot(): SectionPlayerSnapshot;
	navigateTo(index: number): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	getSectionController(): SectionControllerHandle | null;
	waitForSectionController(
		timeoutMs?: number,
	): Promise<SectionControllerHandle | null>;
}
