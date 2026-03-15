import type { AssessmentControllerHandle } from "../controller/AssessmentController.js";
import type { AssessmentPlayerReadinessPhase } from "./public-events.js";

export interface AssessmentPlayerNavigationSnapshot {
	currentIndex: number;
	totalSections: number;
	canNext: boolean;
	canPrevious: boolean;
	currentSectionId?: string;
}

export interface AssessmentPlayerProgressSnapshot {
	visitedSections: number;
	totalSections: number;
}

export interface AssessmentPlayerSnapshot {
	readiness: {
		phase: AssessmentPlayerReadinessPhase;
	};
	navigation: AssessmentPlayerNavigationSnapshot;
	progress: AssessmentPlayerProgressSnapshot;
}

export interface AssessmentPlayerRuntimeHostContract {
	getSnapshot(): AssessmentPlayerSnapshot;
	selectNavigation(): AssessmentPlayerNavigationSnapshot;
	selectReadiness(): AssessmentPlayerSnapshot["readiness"];
	selectProgress(): AssessmentPlayerProgressSnapshot;
	navigateTo(indexOrIdentifier: number | string): boolean;
	navigateNext(): boolean;
	navigatePrevious(): boolean;
	getAssessmentController(): AssessmentControllerHandle | null;
	waitForAssessmentController(
		timeoutMs?: number,
	): Promise<AssessmentControllerHandle | null>;
}
