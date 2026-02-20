/**
 * PIE Assessment Player
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
} from "./AssessmentPlayer.js";
export { AssessmentPlayer } from "./AssessmentPlayer.js";
export type {
	AssessmentFormat,
	NavigationNode,
	QuestionRef,
} from "./qti-navigation.js";
// Navigation helpers/types (useful when building custom UIs without instantiating AssessmentPlayer)
export {
	buildNavigationStructure,
	detectAssessmentFormat,
	getAllQuestionRefs,
} from "./qti-navigation.js";

// Layout Svelte component is exported via package.json path export:
//   @pie-players/pie-assessment-player/Layout.svelte

// Navigation types (optional abstractions)
export type * from "./navigation-types.js";
