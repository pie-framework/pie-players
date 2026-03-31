import { AssessmentPlayerDefaultElement } from "./AssessmentPlayerDefaultElement.js";
import { defineCustomElementSafely } from "@pie-players/pie-players-shared";

defineCustomElementSafely(
	"pie-assessment-player-default",
	AssessmentPlayerDefaultElement,
	"assessment player default tag",
);

export {};
