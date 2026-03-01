import type { SectionController } from "./SectionController.js";
import type { SessionChangedResult } from "./types.js";

export function resolveSectionSessionChanged(args: {
	controller: SectionController | null;
	itemId: string;
	sessionDetail: unknown;
}): SessionChangedResult | null {
	if (!args.controller) return null;
	const canonicalItemId = args.controller.getCanonicalItemId(args.itemId);
	return args.controller.handleItemSessionChanged(
		canonicalItemId,
		args.sessionDetail,
	);
}
