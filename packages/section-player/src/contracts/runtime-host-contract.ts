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

/** One item's local browser score, from {@link SectionPlayerRuntimeHostContract.provideScore}. */
export type SectionItemScore = {
	canonicalItemId: string;
	/**
	 * What the item's `<pie-item-player>` returned from `provideScore()`: one slot
	 * per model, or `false` when the item has nothing to score.
	 */
	outcomes: false | Array<Record<string, unknown> | undefined>;
};

export interface SectionPlayerRuntimeHostContract {
	getSnapshot(): SectionPlayerSnapshot;
	navigateTo(index: number): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	getSectionController(): SectionControllerHandle | null;
	/** Scores every item the section renders, in section order. */
	provideScore(): Promise<SectionItemScore[]>;
	waitForSectionController(
		timeoutMs?: number,
	): Promise<SectionControllerHandle | null>;
}
