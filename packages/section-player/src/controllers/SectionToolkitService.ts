import {
	ToolkitCoordinator,
} from "@pie-players/pie-assessment-toolkit";
import type {
	CoordinatorWithSectionControllers,
	SectionControllerHandle,
} from "./toolkit-section-contracts.js";

export class SectionToolkitService {
	private asCoordinatorWithSectionControllers(
		coordinator: ToolkitCoordinator,
	): CoordinatorWithSectionControllers {
		return coordinator as CoordinatorWithSectionControllers;
	}

	public resolveCoordinator(args: {
		providedCoordinator: ToolkitCoordinator | null;
		preferredAssessmentId: string | null;
		getFallbackAssessmentId: () => string;
		createOwnedCoordinator: (assessmentId: string) => ToolkitCoordinator;
	}): ToolkitCoordinator {
		if (args.providedCoordinator) return args.providedCoordinator;
		return args.createOwnedCoordinator(
			args.preferredAssessmentId ?? args.getFallbackAssessmentId(),
		);
	}

	public async resolveSectionController<TController extends SectionControllerHandle>(
		args: {
			coordinator: ToolkitCoordinator;
			sectionId: string;
			attemptId?: string;
			input?: unknown;
			createDefaultController: () => TController | Promise<TController>;
		},
	): Promise<TController> {
		const controller = await this.asCoordinatorWithSectionControllers(
			args.coordinator,
		).getOrCreateSectionController({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
			input: args.input,
			updateExisting: true,
			createDefaultController: args.createDefaultController,
		});
		return controller as TController;
	}

	public async disposeSectionController(args: {
		coordinator: ToolkitCoordinator;
		sectionId: string;
		attemptId?: string;
	}): Promise<void> {
		await this.asCoordinatorWithSectionControllers(
			args.coordinator,
		).disposeSectionController({
			sectionId: args.sectionId,
			attemptId: args.attemptId,
		});
	}
}
