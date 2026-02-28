import PieItemPlayer from "./PieItemPlayer.svelte";
import { validateCustomElementTag } from "@pie-players/pie-players-shared";

export type { PieItemPlayerElement } from "./types.js";

export function definePieItemPlayer(tagName = "pie-item-player") {
	const validTagName = validateCustomElementTag(
		tagName,
		"pie-item-player tagName",
	);
	if (!customElements.get(validTagName)) {
		customElements.define(
			validTagName,
			PieItemPlayer as unknown as CustomElementConstructor,
		);
	}
}

definePieItemPlayer();
