import PieIifePlayer from "./PieIifePlayer.svelte";
import { validateCustomElementTag } from "@pie-players/pie-players-shared/pie/tag-names";

export type { PieIifePlayerElement } from "./types.js";

export function definePieIifePlayer(tagName = "pie-iife-player") {
	const validTagName = validateCustomElementTag(
		tagName,
		"pie-iife-player tagName",
	);
	if (!customElements.get(validTagName)) {
		customElements.define(
			validTagName,
			PieIifePlayer as unknown as CustomElementConstructor,
		);
	}
}

// Side-effect define for convenience
definePieIifePlayer();
