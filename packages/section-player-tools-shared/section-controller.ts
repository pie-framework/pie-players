export type SectionControllerKeyLike = {
	sectionId?: string;
	attemptId?: string;
};

export type SectionControllerLifecycleEventLike = {
	type?: "ready" | "disposed" | string;
	key?: SectionControllerKeyLike;
};

export type ToolkitCoordinatorWithSectionController<TController> = {
	getSectionController?: (args: {
		sectionId: string;
		attemptId?: string;
	}) => TController | undefined;
	onSectionControllerLifecycle?: (
		listener: (event: SectionControllerLifecycleEventLike) => void,
	) => () => void;
};

export function optionalIdsEqual(left?: string, right?: string): boolean {
	return (left || undefined) === (right || undefined);
}

export function isMatchingSectionControllerLifecycleEvent(
	event: SectionControllerLifecycleEventLike,
	sectionId: string,
	attemptId?: string,
): boolean {
	const eventSectionId = event?.key?.sectionId || "";
	const eventAttemptId = event?.key?.attemptId || undefined;
	if (eventSectionId !== sectionId) return false;
	return optionalIdsEqual(eventAttemptId, attemptId);
}

export function getSectionControllerFromCoordinator<TController>(
	coordinator:
		| ToolkitCoordinatorWithSectionController<TController>
		| null
		| undefined,
	sectionId: string,
	attemptId?: string,
): TController | null {
	if (!coordinator?.getSectionController || !sectionId) return null;
	return (
		coordinator.getSectionController({
			sectionId,
			attemptId,
		}) || null
	);
}
