import PieIifePlayer from "./PieIifePlayer.svelte";

export type { PieIifePlayerElement } from "./types";

export function definePieIifePlayer(tagName = "pie-iife-player") {
	if (!customElements.get(tagName)) {
		customElements.define(
			tagName,
			PieIifePlayer as unknown as CustomElementConstructor,
		);
	}
}

// Side-effect define for convenience
definePieIifePlayer();
