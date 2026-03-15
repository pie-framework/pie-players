import { AssessmentPlayerDefaultElement } from "./AssessmentPlayerDefaultElement.js";

if (!customElements.get("pie-assessment-player-default")) {
	customElements.define(
		"pie-assessment-player-default",
		AssessmentPlayerDefaultElement,
	);
}

export {};
