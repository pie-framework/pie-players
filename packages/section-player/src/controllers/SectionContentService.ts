import type { AssessmentSection, PassageEntity } from "@pie-players/pie-players-shared";
import type {
	SectionContentModel,
	SectionRenderable,
	SectionView,
} from "./types.js";

type PassageWithId = PassageEntity & { id: string };

export class SectionContentService {
	private createUniqueId(
		base: string,
		used: Set<string>,
		prefix: string,
	): string {
		const normalizedBase = base.trim() || prefix;
		let candidate = normalizedBase;
		let counter = 2;
		while (used.has(candidate)) {
			candidate = `${normalizedBase}-${counter++}`;
		}
		used.add(candidate);
		return candidate;
	}

	private resolvePassageBaseId(
		passage: PassageEntity | null | undefined,
		fallbackPrefix: string,
	): string {
		const raw =
			((passage as { id?: unknown } | null)?.id as string | undefined) ||
			((passage as { identifier?: unknown } | null)?.identifier as
				| string
				| undefined) ||
			((passage as { name?: unknown } | null)?.name as string | undefined) ||
			"";
		return raw.trim() || fallbackPrefix;
	}

	private normalizePassageEntity(
		passage: PassageEntity,
		usedPassageIds: Set<string>,
		fallbackPrefix: string,
	): PassageWithId {
		const baseId = this.resolvePassageBaseId(passage, fallbackPrefix);
		const resolvedId = this.createUniqueId(baseId, usedPassageIds, fallbackPrefix);
		return {
			...passage,
			id: resolvedId,
		} as PassageWithId;
	}

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
				renderables: [],
				adapterItemRefs: [],
			};
		}

		const passageMap = new Map<string, PassageEntity>();
		const usedPassageIds = new Set<string>();
		const usedItemIds = new Set<string>();
		const rubricBlocks = (section.rubricBlocks || []).filter((rb) => rb.view.includes(view));
		const instructions = rubricBlocks.filter((rb) => rb.class === "instructions");

		for (const [rubricIndex, rb] of (section.rubricBlocks || []).entries()) {
			if (rb.class === "stimulus" && rb.passage) {
				if (rb.view.includes("candidate") || rb.view.includes(view)) {
					const normalizedPassage = this.normalizePassageEntity(
						rb.passage,
						usedPassageIds,
						`passage-${rubricIndex + 1}`,
					);
					passageMap.set(normalizedPassage.id, normalizedPassage);
				}
			}
		}

		const items = [];
		const adapterItemRefs: Array<{
			identifier: string;
			item: { id: string; identifier: string };
		}> = [];
		for (const [itemIndex, itemRef] of (section.assessmentItemRefs || []).entries()) {
			if (!itemRef.item) continue;
			const itemBaseId =
				itemRef.item.id ||
				itemRef.identifier ||
				itemRef.item.name ||
				`item-${itemIndex + 1}`;
			const resolvedItemId = this.createUniqueId(
				String(itemBaseId),
				usedItemIds,
				`item-${itemIndex + 1}`,
			);
			const normalizedPassage =
				itemRef.item.passage &&
				typeof itemRef.item.passage === "object"
					? (() => {
							const existingPassageId =
								typeof itemRef.item?.passage?.id === "string"
									? itemRef.item.passage.id.trim()
									: "";
							if (existingPassageId && passageMap.has(existingPassageId)) {
								return passageMap.get(existingPassageId);
							}
							return this.normalizePassageEntity(
								itemRef.item.passage,
								usedPassageIds,
								`passage-${itemIndex + 1}`,
							);
					  })()
					: undefined;
			const normalizedItem = {
				...itemRef.item,
				id: resolvedItemId,
				passage: normalizedPassage || itemRef.item.passage,
			} as typeof itemRef.item;
			items.push(normalizedItem);
			const identifier =
				itemRef.identifier || resolvedItemId || itemRef.item.name || "";
			adapterItemRefs.push({
				identifier,
				item: {
					id: resolvedItemId,
					identifier,
				},
			});
			if (
				normalizedPassage &&
				typeof normalizedPassage === "object" &&
				normalizedPassage.id &&
				!passageMap.has(normalizedPassage.id)
			) {
				passageMap.set(normalizedPassage.id, normalizedPassage);
			}
		}

		const renderables: SectionRenderable[] = [
			...Array.from(passageMap.values()).map((entity) => ({
				flavor: "passage" as const,
				entity,
			})),
			...items.map((entity) => ({
				flavor: "item" as const,
				entity,
			})),
			...rubricBlocks
				.filter((rb) => rb.class === "rubric")
				.map((rb, rubricIndex) =>
					rb?.passage
						? this.normalizePassageEntity(
								rb.passage,
								usedPassageIds,
								`rubric-passage-${rubricIndex + 1}`,
						  )
						: null,
				)
				.filter((p): p is PassageWithId => Boolean(p?.config))
				.map((entity) => ({
					flavor: "rubric" as const,
					entity,
				})),
		];

		return {
			passages: Array.from(passageMap.values()),
			items,
			rubricBlocks,
			instructions,
			renderables,
			adapterItemRefs,
		};
	}
}
