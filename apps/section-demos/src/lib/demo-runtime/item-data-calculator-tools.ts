import {
	createPackagedToolRegistry,
	type ToolRegistration,
	type ToolRegistry,
	type ToolToolbarRenderResult
} from '@pie-players/pie-assessment-toolkit';
import type {
	PolicySource,
	PolicySourceDecisionContext,
	PolicySourceResult
} from '@pie-players/pie-assessment-toolkit/policy/engine';

export type ItemDataCalculatorType = 'basic' | 'scientific';

const CALCULATOR_TOOL_ID = 'calculator';

type MetadataScope = {
	scopeId?: string;
	itemId?: string;
	canonicalItemId?: string;
};

type ToolkitCoordinatorWithPolicySource = {
	registerPolicySource?: (source: PolicySource) => () => void;
};

export interface ItemDataCalculatorIntegration {
	readonly toolRegistry: ToolRegistry;
	readonly typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>;
	getCalculatorTypeForScope(scope: MetadataScope): ItemDataCalculatorType | null;
	registerPolicySource(coordinator: ToolkitCoordinatorWithPolicySource): (() => void) | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function addStringId(ids: Set<string>, value: unknown): void {
	if (typeof value === 'string' && value.trim()) {
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

export function getCalculatorTypeFromToolMetadata(source: unknown): ItemDataCalculatorType | null {
	if (!isRecord(source)) return null;

	const toolMetadata = source.toolMetadata;
	if (!isRecord(toolMetadata)) return null;

	const calculator = toolMetadata.calculator;
	return calculator === 'basic' || calculator === 'scientific' ? calculator : null;
}

function getCalculatorTypeForIds(
	typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>,
	ids: Iterable<string>
): ItemDataCalculatorType | null {
	for (const id of ids) {
		const calculatorType = typeByItemId.get(id);
		if (calculatorType) return calculatorType;
	}
	return null;
}

function createTypeByItemId(section: unknown): Map<string, ItemDataCalculatorType> {
	const typeByItemId = new Map<string, ItemDataCalculatorType>();
	const itemRefs = isRecord(section) && Array.isArray(section.assessmentItemRefs)
		? section.assessmentItemRefs
		: [];

	for (const itemRef of itemRefs) {
		const ref = isRecord(itemRef) ? itemRef : {};
		const calculatorType =
			getCalculatorTypeFromToolMetadata(ref.item) ?? getCalculatorTypeFromToolMetadata(ref);
		if (!calculatorType) continue;

		for (const id of collectItemIdsFromRef(itemRef)) {
			typeByItemId.set(id, calculatorType);
		}
	}

	return typeByItemId;
}

function setCalculatorElementType(
	element: HTMLElement | null | undefined,
	calculatorType: ItemDataCalculatorType
): void {
	if (!element) return;

	const calculatorElement = element as HTMLElement & {
		calculatorType?: ItemDataCalculatorType;
		availableTypes?: ItemDataCalculatorType[];
	};
	const availableTypes = calculatorElement.availableTypes;
	const hasMatchingAvailableTypes =
		Array.isArray(availableTypes) &&
		availableTypes.length === 1 &&
		availableTypes[0] === calculatorType;

	if (
		calculatorElement.calculatorType === calculatorType &&
		hasMatchingAvailableTypes &&
		element.getAttribute('calculator-type') === calculatorType
	) {
		return;
	}

	calculatorElement.calculatorType = calculatorType;
	calculatorElement.availableTypes = [calculatorType];
	element.setAttribute('calculator-type', calculatorType);
}

function applyCalculatorTypeToRenderResult(
	result: ToolToolbarRenderResult | null,
	calculatorType: ItemDataCalculatorType
): ToolToolbarRenderResult | null {
	if (!result) return result;

	const displayName = calculatorType === 'scientific' ? 'Scientific Calculator' : 'Basic Calculator';
	if (result.button) {
		result.button.label = displayName;
		result.button.ariaLabel = `Open ${displayName.toLowerCase()}`;
		result.button.tooltip = displayName;
	}

	for (const entry of result.elements ?? []) {
		setCalculatorElementType(entry.element, calculatorType);
	}

	const originalSync = result.sync;
	result.sync = () => {
		originalSync?.();
		if (result.button) {
			const active = result.button.active === true;
			result.button.label = displayName;
			result.button.ariaLabel = active
				? `Close ${displayName.toLowerCase()}`
				: `Open ${displayName.toLowerCase()}`;
			result.button.tooltip = active ? `Close ${displayName.toLowerCase()}` : displayName;
		}
		for (const entry of result.elements ?? []) {
			setCalculatorElementType(entry.element, calculatorType);
		}
	};

	return result;
}

function createCalculatorPolicySource(
	typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>
): PolicySource {
	return {
		id: 'section-demo-item-data-calculator',
		refine(context: PolicySourceDecisionContext): PolicySourceResult {
			if (context.request.level !== 'item' || !context.candidates.includes(CALCULATOR_TOOL_ID)) {
				return { refinedCandidates: [...context.candidates] };
			}

			const calculatorType = getCalculatorTypeForIds(
				typeByItemId,
				collectItemIdsFromScope(context.request.scope)
			);
			if (calculatorType) {
				return { refinedCandidates: [...context.candidates] };
			}

			return {
				refinedCandidates: context.candidates.filter((toolId) => toolId !== CALCULATOR_TOOL_ID),
				decisions: [
					{
						rule: 'custom-source',
						featureId: CALCULATOR_TOOL_ID,
						action: 'block',
						sourceType: 'custom',
						reason: 'Demo item data does not request a calculator for this item.'
					}
				]
			};
		}
	};
}

function overrideCalculatorRegistration(
	registry: ToolRegistry,
	typeByItemId: ReadonlyMap<string, ItemDataCalculatorType>
): void {
	const original = registry.get(CALCULATOR_TOOL_ID);
	if (!original) return;

	const registration: ToolRegistration = {
		...original,
		isVisibleInContext(context) {
			return (
				getCalculatorTypeFromToolMetadata((context as { item?: unknown }).item) !== null ||
				getCalculatorTypeForIds(
					typeByItemId,
					collectItemIdsFromItem((context as { item?: unknown }).item)
				) !== null
			);
		},
		renderToolbar(context, toolbarContext) {
			const calculatorType =
				getCalculatorTypeFromToolMetadata((context as { item?: unknown }).item) ??
				getCalculatorTypeForIds(typeByItemId, collectItemIdsFromScope(toolbarContext.scope)) ??
				getCalculatorTypeForIds(
					typeByItemId,
					collectItemIdsFromItem((context as { item?: unknown }).item)
				);
			if (!calculatorType) return null;

			return applyCalculatorTypeToRenderResult(
				original.renderToolbar.call(original, context, toolbarContext),
				calculatorType
			);
		}
	};

	registry.override(registration);
}

export function createItemDataCalculatorIntegration(section: unknown): ItemDataCalculatorIntegration {
	const toolRegistry = createPackagedToolRegistry();
	const typeByItemId = createTypeByItemId(section);
	overrideCalculatorRegistration(toolRegistry, typeByItemId);

	return {
		toolRegistry,
		typeByItemId,
		getCalculatorTypeForScope(scope) {
			return getCalculatorTypeForIds(typeByItemId, collectItemIdsFromScope(scope));
		},
		registerPolicySource(coordinator) {
			return coordinator.registerPolicySource?.(createCalculatorPolicySource(typeByItemId));
		}
	};
}
