import type { AssessmentPlayerDefaultElement } from "../components/AssessmentPlayerDefaultElement.js";
import type { AssessmentPlayerShellElement } from "../components/AssessmentPlayerShellElement.js";

/** Native host interface, derived from the implementation's public members. */
export type PieAssessmentPlayerDefaultElement = Pick<
	AssessmentPlayerDefaultElement,
	keyof AssessmentPlayerDefaultElement
>;

/** Native host interface for `<pie-assessment-player-shell>`. */
export type PieAssessmentPlayerShellElement = Pick<
	AssessmentPlayerShellElement,
	keyof AssessmentPlayerShellElement
>;

declare global {
	interface HTMLElementTagNameMap {
		"pie-assessment-player-default": PieAssessmentPlayerDefaultElement;
		"pie-assessment-player-shell": PieAssessmentPlayerShellElement;
	}
}
