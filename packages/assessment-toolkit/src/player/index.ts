/**
 * PIE Assessment Toolkit - Assessment Player
 *
 * Optional default implementation showing how to wire toolkit services together.
 *
 * Products can:
 * - Use AssessmentPlayer as-is
 * - Extend it for custom behavior
 * - Use it as a pattern for their own implementation
 * - Ignore it entirely and wire services directly
 */

export type {
	NavigationState,
	ReferencePlayerConfig,
} from "./AssessmentPlayer";
export { AssessmentPlayer } from "./AssessmentPlayer";

// Navigation helpers/types (useful when building custom UIs without instantiating AssessmentPlayer)
export {
	buildNavigationStructure,
	detectAssessmentFormat,
	getAllQuestionRefs,
} from "./qti-navigation";
export type { AssessmentFormat, NavigationNode, QuestionRef } from "./qti-navigation";

// Layout Svelte component is exported via package.json path export:
//   @pie-framework/pie-assessment-toolkit/player/AssessmentLayout.svelte

// Navigation types (optional abstractions)
export type * from "./navigation-types";
