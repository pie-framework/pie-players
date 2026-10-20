import type {
	AssessmentSection,
	ItemEntity,
	PassageEntity,
	ReferencedPassageEntity,
} from "@pie-players/pie-players-shared";
import type { FormativeItemPolicy } from "@pie-players/pie-players-shared/formative";
import type { ItemSettings } from "@pie-players/pie-players-shared/types";
import type {
	SectionContentModel,
	SectionRenderable,
	SectionView,
} from "./types.js";

type PassageWithId = PassageEntity & { id: string };

/**
 * An authored id, trimmed, or `undefined` when absent or blank. A number reads
 * as its decimal string, as item ids always have. Anything else is refused by
 * its path in the section: it would stringify to `[object Object]`, or fail
 * inside normalisation with an error that names nothing the host wrote.
 */
function readAuthoredId(value: unknown, path: string): string | undefined {
	if (value === undefined || value === null) return undefined;
	if (typeof value === "string") return value.trim() || undefined;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	const kind = Array.isArray(value) ? "array" : typeof value;
	throw new TypeError(`Section ${path} must be a string, got ${kind}`);
}

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
		passage: ReferencedPassageEntity,
		path: string,
		fallbackPrefix: string,
	): string {
		const authored = passage as {
			id?: unknown;
			identifier?: unknown;
			name?: unknown;
		};
		return (
			readAuthoredId(authored.id, `${path}.id`) ??
			readAuthoredId(authored.identifier, `${path}.identifier`) ??
			readAuthoredId(authored.name, `${path}.name`) ??
			fallbackPrefix
		);
	}

	private normalizePassageEntity(
		passage: ReferencedPassageEntity,
		path: string,
		usedPassageIds: Set<string>,
		fallbackPrefix: string,
	): PassageWithId {
		const baseId = this.resolvePassageBaseId(passage, path, fallbackPrefix);
		const resolvedId = this.createUniqueId(
			baseId,
			usedPassageIds,
			fallbackPrefix,
		);
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
				stimulusRenderableIdsByRef: {},
			};
		}

		const passageMap = new Map<string, PassageEntity>();
		const usedPassageIds = new Set<string>();
		const usedItemIds = new Set<string>();
		// Authored `timedMedia.stimulusRef` names a rubric block or a passage;
		// renderables are keyed by the normalized passage id this service assigns.
		// Recorded here rather than re-derived, because deriving that mapping twice
		// is two implementations of one mapping — the same reason the item ref's
		// formative policy rides along on `adapterItemRefs`.
		const stimulusRenderableIdsByRef: Record<string, string> = {};
		const rubricBlocks = (section.rubricBlocks || []).filter((rb) =>
			rb.view.includes(view),
		);
		const instructions = rubricBlocks.filter(
			(rb) => rb.class === "instructions",
		);

		for (const [rubricIndex, rb] of (section.rubricBlocks || []).entries()) {
			if (rb.class === "stimulus" && rb.passage) {
				if (rb.view.includes("candidate") || rb.view.includes(view)) {
					const passagePath = `rubricBlocks[${rubricIndex}].passage`;
					const normalizedPassage = this.normalizePassageEntity(
						rb.passage,
						passagePath,
						usedPassageIds,
						`passage-${rubricIndex + 1}`,
					);
					passageMap.set(normalizedPassage.id, normalizedPassage);
					// Both spellings resolve: the rubric block's identifier, which is
					// what the contract's examples reference, and the authored passage
					// id, which is what a section reusing a shared passage has to hand.
					if (rb.identifier) {
						stimulusRenderableIdsByRef[rb.identifier] = normalizedPassage.id;
					}
					const authoredPassageId = readAuthoredId(
						rb.passage.id,
						`${passagePath}.id`,
					);
					if (authoredPassageId) {
						stimulusRenderableIdsByRef[authoredPassageId] =
							normalizedPassage.id;
					}
					stimulusRenderableIdsByRef[normalizedPassage.id] =
						normalizedPassage.id;
				}
			}
		}

		// A referenced item or passage may omit `baseId` and `version`. The content
		// model keeps the entity types, as no player reads either field.
		const items: ItemEntity[] = [];
		const adapterItemRefs: Array<{
			identifier: string;
			item: { id: string; identifier: string };
			formative?: FormativeItemPolicy;
			settings?: ItemSettings;
		}> = [];
		for (const [itemIndex, itemRef] of (
			section.assessmentItemRefs || []
		).entries()) {
			if (!itemRef.item) continue;
			const itemRefPath = `assessmentItemRefs[${itemIndex}]`;
			const authoredItemId = readAuthoredId(
				itemRef.item.id,
				`${itemRefPath}.item.id`,
			);
			const authoredIdentifier = readAuthoredId(
				itemRef.identifier,
				`${itemRefPath}.identifier`,
			);
			const itemBaseId =
				authoredItemId ??
				authoredIdentifier ??
				readAuthoredId(itemRef.item.name, `${itemRefPath}.item.name`) ??
				`item-${itemIndex + 1}`;
			const resolvedItemId = this.createUniqueId(
				itemBaseId,
				usedItemIds,
				`item-${itemIndex + 1}`,
			);
			const passagePath = `${itemRefPath}.item.passage`;
			const normalizedPassage =
				itemRef.item.passage && typeof itemRef.item.passage === "object"
					? (() => {
							const existingPassageId = readAuthoredId(
								itemRef.item.passage.id,
								`${passagePath}.id`,
							);
							if (existingPassageId && passageMap.has(existingPassageId)) {
								return passageMap.get(existingPassageId);
							}
							return this.normalizePassageEntity(
								itemRef.item.passage,
								passagePath,
								usedPassageIds,
								`passage-${itemIndex + 1}`,
							);
						})()
					: undefined;
			const normalizedItem = {
				...itemRef.item,
				id: resolvedItemId,
				passage: normalizedPassage || itemRef.item.passage,
			} as ItemEntity;
			items.push(normalizedItem);
			// The authored identifier as written, untrimmed, since sessions are keyed by it.
			const identifier =
				authoredIdentifier === undefined
					? resolvedItemId
					: String(itemRef.identifier);
			adapterItemRefs.push({
				identifier,
				item: {
					id: resolvedItemId,
					identifier,
				},
				formative: itemRef.formative,
				settings: itemRef.settings,
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
								`rubricBlocks[${(section.rubricBlocks || []).indexOf(rb)}].passage`,
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
			stimulusRenderableIdsByRef,
		};
	}
}
