import {
	setCurrentPosition,
	upsertVisitedItem,
	type TestAttemptSession,
} from "@pie-players/pie-assessment-toolkit";
import type { ItemEntity } from "@pie-players/pie-players-shared";
import type { NavigationResult } from "./types.js";

export class SectionItemNavigationService {
	public navigate(args: {
		index: number;
		isPageMode: boolean;
		items: ItemEntity[];
		currentItemIndex: number;
		sectionIdentifier?: string;
		testAttemptSession: TestAttemptSession;
	}): NavigationResult | null {
		if (args.isPageMode) return null;
		if (args.index < 0 || args.index >= args.items.length) return null;

		const previousItemId = args.items[args.currentItemIndex]?.id || "";
		const currentItemId = args.items[args.index]?.id || "";
		const nextTestAttemptSession = upsertVisitedItem(
			setCurrentPosition(args.testAttemptSession, {
				currentItemIndex: args.index,
				currentSectionIdentifier: args.sectionIdentifier,
			}),
			currentItemId,
		);

		return {
			nextIndex: args.index,
			testAttemptSession: nextTestAttemptSession,
			eventDetail: {
				previousItemId,
				currentItemId,
				itemIndex: args.index,
				totalItems: args.items.length,
				timestamp: Date.now(),
			},
		};
	}
}
