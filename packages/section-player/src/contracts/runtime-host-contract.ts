import type {
	SectionPlayerReadinessChangeDetail,
} from "./public-events.js";

export type SectionPlayerSnapshot = {
	readiness: SectionPlayerReadinessChangeDetail;
	composition: {
		itemsCount: number;
		passagesCount: number;
	};
	navigation: {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		currentItemId?: string;
	};
};

export interface SectionPlayerRuntimeHostContract {
	getSnapshot(): SectionPlayerSnapshot;
	selectComposition(): SectionPlayerSnapshot["composition"];
	selectNavigation(): {
		currentIndex: number;
		totalItems: number;
		canNext: boolean;
		canPrevious: boolean;
		currentItemId?: string;
	};
	selectReadiness(): SectionPlayerReadinessChangeDetail;
	navigateTo(index: number): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	preloadNow(): void;
}
