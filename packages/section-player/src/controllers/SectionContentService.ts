import type { AssessmentSection, PassageEntity } from "@pie-players/pie-players-shared";
import type { SectionContentModel, SectionView } from "./types.js";

export class SectionContentService {
	public build(
		section: AssessmentSection | null,
		view: SectionView,
	): SectionContentModel {
		if (!section) {
			return {
				passages: [],
				items: [],
				rubricBlocks: [],
				instructions: [],
				adapterItemRefs: [],
			};
		}

		const passageMap = new Map<string, PassageEntity>();
		const rubricBlocks = (section.rubricBlocks || []).filter((rb) => rb.view === view);
		const instructions = rubricBlocks.filter((rb) => rb.class === "instructions");

		for (const rb of section.rubricBlocks || []) {
			if (rb.class === "stimulus" && rb.passage?.id) {
				if (rb.view === "candidate" || rb.view === view) {
					passageMap.set(rb.passage.id, rb.passage);
				}
			}
		}

		const items = [];
		for (const itemRef of section.assessmentItemRefs || []) {
			if (!itemRef.item) continue;
			items.push(itemRef.item);
			if (
				itemRef.item.passage &&
				typeof itemRef.item.passage === "object" &&
				itemRef.item.passage.id &&
				!passageMap.has(itemRef.item.passage.id)
			) {
				passageMap.set(itemRef.item.passage.id, itemRef.item.passage);
			}
		}

		const adapterItemRefs = (section.assessmentItemRefs || []).map((itemRef) => ({
			identifier: itemRef.identifier || itemRef.item?.id || itemRef.item?.name || "",
			item: {
				id: itemRef.item?.id,
				identifier: itemRef.identifier || itemRef.item?.id,
			},
		}));

		return {
			passages: Array.from(passageMap.values()),
			items,
			rubricBlocks,
			instructions,
			adapterItemRefs,
		};
	}
}
