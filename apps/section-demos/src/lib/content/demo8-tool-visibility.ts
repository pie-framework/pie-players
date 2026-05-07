import type { AssessmentSection } from "@pie-players/pie-players-shared/types";
import { demo3Section } from "./demo3-three-questions";

type CalculatorToolMetadata = {
	toolMetadata?: {
		calculator?: "basic" | "scientific";
	};
};

function withCalculatorToolMetadata(
	itemRef: NonNullable<AssessmentSection["assessmentItemRefs"]>[number],
	calculator: "basic" | "scientific",
) {
	const refWithMetadata = itemRef as typeof itemRef & CalculatorToolMetadata;
	const itemWithMetadata = itemRef.item as typeof itemRef.item & CalculatorToolMetadata;

	return {
		...itemRef,
		toolMetadata: {
			...(refWithMetadata.toolMetadata ?? {}),
			calculator,
		},
		item: {
			...itemRef.item,
			toolMetadata: {
				...(itemWithMetadata.toolMetadata ?? {}),
				calculator,
			},
		},
	};
}

export const demo8ToolVisibilitySection: AssessmentSection = {
	...demo3Section,
	identifier: "demo8-tool-visibility",
	title: "Demo 8: Tool Visibility from Item Data",
	assessmentItemRefs: (demo3Section.assessmentItemRefs ?? []).map((itemRef, index) => {
		if (index === 0) return withCalculatorToolMetadata(itemRef, "basic");
		if (index === 1) return withCalculatorToolMetadata(itemRef, "scientific");
		return itemRef;
	}) as AssessmentSection["assessmentItemRefs"],
};
