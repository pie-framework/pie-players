import type { NormalizedTextMap } from "../text-processing.js";

export const createRangeFromVisibleMap = (
	visibleMap: NormalizedTextMap | undefined,
	start: number,
	end: number,
): Range | null => {
	if (!visibleMap || typeof document === "undefined") return null;
	const startMapping = visibleMap.get(start);
	let endMapping = visibleMap.get(Math.max(start, end - 1));
	if (!startMapping) return null;
	if (!endMapping) endMapping = startMapping;
	try {
		const range = document.createRange();
		range.setStart(startMapping.node, startMapping.offset);
		range.setEnd(endMapping.node, endMapping.offset + 1);
		return range;
	} catch {
		return null;
	}
};
