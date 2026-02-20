export { AssessmentPlayer, type NavigationState, type ReferencePlayerConfig } from "./player/AssessmentPlayer.js";
export {
	buildNavigationStructure,
	detectAssessmentFormat,
	getAllQuestionRefs,
	type AssessmentFormat,
	type NavigationNode,
	type QuestionRef,
} from "./player/qti-navigation.js";
export type * from "./player/navigation-types.js";

export { default as ReferenceLayout } from "./reference-layout/ReferenceLayout.svelte";
export { default as AssessmentLayout } from "./player/AssessmentLayout.svelte";
