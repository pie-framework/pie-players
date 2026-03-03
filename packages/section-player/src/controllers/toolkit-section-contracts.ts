import type { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import type { SectionControllerHandle } from "@pie-players/pie-assessment-toolkit";
export type {
	SectionControllerContext,
	SectionControllerHandle,
	SectionControllerKey,
	SectionControllerPersistenceStrategy,
} from "@pie-players/pie-assessment-toolkit";

export type CoordinatorWithSectionControllers = ToolkitCoordinator & {
	getOrCreateSectionController(args: {
		sectionId: string;
		attemptId?: string;
		input?: unknown;
		updateExisting?: boolean;
		createDefaultController: () =>
			| SectionControllerHandle
			| Promise<SectionControllerHandle>;
	}): Promise<SectionControllerHandle>;
	disposeSectionController(args: {
		sectionId: string;
		attemptId?: string;
		persistBeforeDispose?: boolean;
		clearPersistence?: boolean;
	}): Promise<void>;
};
