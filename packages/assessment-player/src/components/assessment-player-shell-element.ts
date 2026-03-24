import { AssessmentPlayerShellElement } from "./AssessmentPlayerShellElement.js";
import { defineCustomElementSafely } from "@pie-players/pie-players-shared";

defineCustomElementSafely(
	"pie-assessment-player-shell",
	AssessmentPlayerShellElement,
	"assessment player shell tag",
);

export {};
