import PieAssessmentPlayer from "./PieAssessmentPlayer.svelte";

export function definePieAssessmentPlayer(tagName = "pie-assessment-player") {
	if (!customElements.get(tagName)) {
		customElements.define(
			tagName,
			PieAssessmentPlayer as unknown as CustomElementConstructor,
		);
	}
}

// Side-effect define for convenience
definePieAssessmentPlayer();
