import {
	connectContextWithRetry,
	ContextProvider,
	ContextRoot,
	createContext,
} from "@pie-players/pie-context";
import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
import type { PlayerElementParams } from "./player-action.js";

export type SectionPlayerCardRenderContext = {
	resolvedPlayerTag: string;
	playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
	cardTitleFormatter?: SectionPlayerCardTitleFormatter;
};

export const sectionPlayerCardRenderContext =
	createContext<SectionPlayerCardRenderContext>(
		Symbol.for("@pie-players/pie-section-player/card-render-context"),
	);

export function getHostElementFromAnchor(
	anchor: HTMLElement | null,
): HTMLElement | null {
	if (!anchor) return null;
	const rootNode = anchor.getRootNode();
	if (rootNode && "host" in rootNode) {
		return (rootNode as ShadowRoot).host as HTMLElement;
	}
	return anchor.parentElement as HTMLElement | null;
}

export function connectSectionPlayerCardRenderContext(
	host: HTMLElement,
	onValue: (value: SectionPlayerCardRenderContext) => void,
): () => void {
	return connectContextWithRetry(host, sectionPlayerCardRenderContext, onValue);
}

export function createSectionPlayerCardRenderContextProvider(
	host: HTMLElement,
	initialValue: SectionPlayerCardRenderContext,
) {
	const provider = new ContextProvider(host, {
		context: sectionPlayerCardRenderContext,
		initialValue,
	});
	provider.connect();
	const root = new ContextRoot(host);
	root.attach();
	return {
		setValue: (value: SectionPlayerCardRenderContext) =>
			provider.setValue(value),
		disconnect: () => {
			root.detach();
			provider.disconnect();
		},
	};
}
