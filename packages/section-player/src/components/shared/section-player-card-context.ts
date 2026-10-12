import {
	connectContextWithRetry,
	ContextProvider,
	createContext,
} from "@pie-players/pie-context";
import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
import type { PlayerElementParams } from "./player-action.js";

export type SectionPlayerCardRenderContext = {
	resolvedPlayerTag: string;
	playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
	cardTitleFormatter?: SectionPlayerCardTitleFormatter;
};

const sectionPlayerCardRenderContext =
	createContext<SectionPlayerCardRenderContext>(
		Symbol.for("@pie-players/pie-section-player/card-render-context"),
	);

export function connectSectionPlayerCardRenderContext(
	host: HTMLElement,
	onValue: (value: SectionPlayerCardRenderContext) => void,
): () => void {
	return connectContextWithRetry(host, sectionPlayerCardRenderContext, onValue);
}

/**
 * A card that subscribes before this provider connects is answered through the
 * document's context root, which replays its request when the provider
 * announces itself.
 */
export function createSectionPlayerCardRenderContextProvider(
	host: HTMLElement,
	initialValue: SectionPlayerCardRenderContext,
) {
	const provider = new ContextProvider(host, {
		context: sectionPlayerCardRenderContext,
		initialValue,
	});
	provider.connect();
	return {
		setValue: (value: SectionPlayerCardRenderContext) =>
			provider.setValue(value),
		disconnect: () => provider.disconnect(),
	};
}
