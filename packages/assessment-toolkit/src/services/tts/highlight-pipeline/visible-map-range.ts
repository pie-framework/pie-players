import type { NormalizedTextMap } from "../text-processing.js";

type Mapping = { node: Text; offset: number };

const treeOf = (mapping: Mapping): Node =>
	mapping.node.getRootNode?.() ?? mapping.node;

const rangeBetween = (start: Mapping, end: Mapping): Range | null => {
	try {
		const range = document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset + 1);
		return range;
	} catch {
		return null;
	}
};

/**
 * The range over visible characters `start` to `end` (exclusive). A live range
 * holds one tree, so when the span runs into a shadow tree, or out of one, the
 * range ends at the last character in the tree it starts in.
 */
export const createRangeFromVisibleMap = (
	visibleMap: NormalizedTextMap | undefined,
	start: number,
	end: number,
): Range | null => {
	if (!visibleMap || typeof document === "undefined") return null;
	if (end <= start) return null;
	const startMapping = visibleMap.get(start);
	let endMapping = visibleMap.get(Math.max(start, end - 1));
	if (!startMapping) return null;
	if (!endMapping) endMapping = startMapping;
	if (treeOf(endMapping) !== treeOf(startMapping)) {
		const tree = treeOf(startMapping);
		endMapping = startMapping;
		for (let index = start + 1; index < end; index++) {
			const mapping = visibleMap.get(index);
			if (mapping && treeOf(mapping) === tree) endMapping = mapping;
		}
	}
	return rangeBetween(startMapping, endMapping);
};

/**
 * The ranges over visible characters `start` to `end` (exclusive), one per run of
 * characters in the same tree, so a span crossing shadow boundaries paints in
 * each tree it covers. A span within one tree gives exactly
 * {@link createRangeFromVisibleMap}'s range.
 */
export const createRangesFromVisibleMap = (
	visibleMap: NormalizedTextMap | undefined,
	start: number,
	end: number,
): Range[] => {
	if (!visibleMap || typeof document === "undefined" || end <= start) return [];
	const startMapping = visibleMap.get(start);
	if (!startMapping) return [];
	const tree = treeOf(startMapping);
	let crossesTrees = false;
	for (let index = start + 1; index < end && !crossesTrees; index++) {
		const mapping = visibleMap.get(index);
		if (mapping && treeOf(mapping) !== tree) crossesTrees = true;
	}
	if (!crossesTrees) {
		const range = createRangeFromVisibleMap(visibleMap, start, end);
		return range ? [range] : [];
	}
	const ranges: Range[] = [];
	let runStart: Mapping | null = null;
	let runEnd: Mapping | null = null;
	const closeRun = () => {
		if (runStart && runEnd) {
			const range = rangeBetween(runStart, runEnd);
			if (range) ranges.push(range);
		}
		runStart = null;
		runEnd = null;
	};
	for (let index = start; index < end; index++) {
		const mapping = visibleMap.get(index);
		if (!mapping) continue;
		if (runStart && treeOf(runStart) !== treeOf(mapping)) closeRun();
		if (!runStart) runStart = mapping;
		runEnd = mapping;
	}
	closeRun();
	return ranges;
};
