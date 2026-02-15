import PieAssessmentPlayer from "./PieAssessmentPlayer.svelte";
import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";

export function definePieAssessmentPlayer(tagName = "pie-assessment-player") {
	const validTagName = validateCustomElementTag(
		tagName,
		"pie-assessment-player tagName",
	);
	if (!customElements.get(validTagName)) {
		customElements.define(
			validTagName,
			PieAssessmentPlayer as unknown as CustomElementConstructor,
		);
	}
}

// Side-effect define for convenience
definePieAssessmentPlayer();
