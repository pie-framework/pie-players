import { AssessmentPlayerShellElement } from "./AssessmentPlayerShellElement.js";

if (!customElements.get("pie-assessment-player-shell")) {
	customElements.define("pie-assessment-player-shell", AssessmentPlayerShellElement);
}

export {};
