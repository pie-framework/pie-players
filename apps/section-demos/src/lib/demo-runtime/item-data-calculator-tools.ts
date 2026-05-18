import type {
	ToolContextResolver,
	ToolContextResolverMap,
} from "@pie-players/pie-assessment-toolkit";

export type ItemDataCalculatorType = "basic" | "scientific";

const CALCULATOR_TOOL_ID = "calculator";

type MetadataScope = {
	scopeId?: string;
	itemId?: string;
	canonicalItemId?: string;
};

export interface ItemDataCalculatorIntegration {
	readonly typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>;
	readonly toolContextResolvers: ToolContextResolverMap;
	getCalculatorTypeForScope(
		scope: MetadataScope,
	): ItemDataCalculatorType | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function addStringId(ids: Set<string>, value: unknown): void {
	if (typeof value === "string" && value.trim()) {
		ids.add(value);
	}
}

function collectItemIdsFromItem(item: unknown): Set<string> {
	const ids = new Set<string>();
	if (!isRecord(item)) return ids;

	addStringId(ids, item.id);
	addStringId(ids, item._id);
	addStringId(ids, item.baseId);
	addStringId(ids, item.identifier);

	return ids;
}

function collectItemIdsFromRef(itemRef: unknown): Set<string> {
	const ref = isRecord(itemRef) ? itemRef : {};
	const ids = collectItemIdsFromItem(ref.item);

	addStringId(ids, ref.id);
	addStringId(ids, ref.identifier);
	addStringId(ids, ref.itemVId);
	addStringId(ids, ref.itemId);
	addStringId(ids, ref.canonicalItemId);

	return ids;
}

function collectItemIdsFromScope(scope: MetadataScope): Set<string> {
	const ids = new Set<string>();

	addStringId(ids, scope.scopeId);
	addStringId(ids, scope.itemId);
	addStringId(ids, scope.canonicalItemId);

	return ids;
}

export function getCalculatorTypeFromToolMetadata(
	source: unknown,
): ItemDataCalculatorType | null {
	if (!isRecord(source)) return null;

	const toolMetadata = source.toolMetadata;
	if (!isRecord(toolMetadata)) return null;

	const calculator = toolMetadata.calculator;
	return calculator === "basic" || calculator === "scientific"
		? calculator
		: null;
}

function getCalculatorTypeForIds(
	typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>,
	ids: Iterable<string>,
): ItemDataCalculatorType | null {
	for (const id of ids) {
		const calculatorType = typeByItemId.get(id);
		if (calculatorType) return calculatorType;
	}
	return null;
}

function createTypeByItemId(
	section: unknown,
): Map<string, ItemDataCalculatorType> {
	const typeByItemId = new Map<string, ItemDataCalculatorType>();
	const itemRefs =
		isRecord(section) && Array.isArray(section.assessmentItemRefs)
			? section.assessmentItemRefs
			: [];

	for (const itemRef of itemRefs) {
		const ref = isRecord(itemRef) ? itemRef : {};
		const calculatorType =
			getCalculatorTypeFromToolMetadata(ref.item) ??
			getCalculatorTypeFromToolMetadata(ref);
		if (!calculatorType) continue;

		for (const id of collectItemIdsFromRef(itemRef)) {
			typeByItemId.set(id, calculatorType);
		}
	}

	return typeByItemId;
}

function createCalculatorContextResolver(
	typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>,
): ToolContextResolver {
	return ({ context, toolbarContext }) => {
		const calculatorType =
			getCalculatorTypeFromToolMetadata((context as { item?: unknown }).item) ??
			getCalculatorTypeFromToolMetadata(
				(context as { itemRef?: unknown }).itemRef,
			) ??
			getCalculatorTypeForIds(
				typeByItemId,
				collectItemIdsFromScope(toolbarContext.scope),
			) ??
			getCalculatorTypeForIds(
				typeByItemId,
				collectItemIdsFromItem((context as { item?: unknown }).item),
			) ??
			getCalculatorTypeForIds(
				typeByItemId,
				collectItemIdsFromRef((context as { itemRef?: unknown }).itemRef),
			);

		if (!calculatorType) {
			return {
				visible: false,
				reason: "Demo item data does not request a calculator for this item.",
			};
		}

		return {
			visible: true,
			params: {
				calculatorType,
				availableTypes: [calculatorType],
			},
		};
	};
}

export function createItemDataCalculatorIntegration(
	section: unknown,
): ItemDataCalculatorIntegration {
	const typeByItemId = createTypeByItemId(section);

	return {
		typeByItemId,
		toolContextResolvers: {
			[CALCULATOR_TOOL_ID]: createCalculatorContextResolver(typeByItemId),
		},
		getCalculatorTypeForScope(scope) {
			return getCalculatorTypeForIds(
				typeByItemId,
				collectItemIdsFromScope(scope),
			);
		},
	};
}
