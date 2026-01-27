import type { PieExample } from "$lib/sample-library/pie-examples";
import { PIE_ELEMENT_GROUPS } from "$lib/sample-library/pie-examples";

export interface ElementTypeInfo {
	id: string;
	name: string;
	description: string;
	icon: string;
	examples: PieExample[];
}

export const ELEMENT_TYPES: ElementTypeInfo[] = PIE_ELEMENT_GROUPS.map((group) => ({
	id: group.id,
	name: group.name,
	description: group.description,
	icon: getIconForElementType(group.id),
	examples: group.examples,
}));

function getIconForElementType(id: string): string {
	const iconMap: Record<string, string> = {
		"multiple-choice": "☑️",
		"extended-text": "📝",
		"explicit-constructed-response": "✍️",
		passage: "📖",
		"drag-and-drop-items": "🔄",
		matching: "🔗",
		math: "🔢",
		hotspot: "🎯",
		drawing: "🎨",
		"inline-dropdown": "📋",
		"select-text": "🖍️",
		charting: "📊",
		rubric: "📐",
	};
	return iconMap[id] || "📄";
}

export function getElementTypeById(id: string): ElementTypeInfo | undefined {
	return ELEMENT_TYPES.find((type) => type.id === id);
}

export function getDefaultExampleForType(
	typeId: string,
): PieExample | undefined {
	const type = getElementTypeById(typeId);
	return type?.examples[0];
}
