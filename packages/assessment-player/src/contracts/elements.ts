import type { AssessmentPlayerDefaultElement } from "../components/AssessmentPlayerDefaultElement.js";

/** Native host interface, derived from the implementation's public members. */
export type PieAssessmentPlayerDefaultElement = Pick<
	AssessmentPlayerDefaultElement,
	keyof AssessmentPlayerDefaultElement
>;

declare global {
	interface HTMLElementTagNameMap {
		"pie-assessment-player-default": PieAssessmentPlayerDefaultElement;
	}
}
