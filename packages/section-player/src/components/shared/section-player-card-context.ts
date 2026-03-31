import {
	ContextConsumer,
	ContextProvider,
	ContextRoot,
	createContext,
} from "@pie-players/pie-context";
import type { UnknownContext } from "@pie-players/pie-context";
import type { SectionPlayerCardTitleFormatter } from "../../contracts/card-title-formatters.js";
import type { PlayerElementParams } from "./player-action.js";

export type SectionPlayerCardRenderContext = {
	resolvedPlayerTag: string;
	playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
	cardTitleFormatter?: SectionPlayerCardTitleFormatter;
};

export const sectionPlayerCardRenderContext = createContext<SectionPlayerCardRenderContext>(
	Symbol.for("@pie-players/pie-section-player/card-render-context"),
);

export function getHostElementFromAnchor(anchor: HTMLElement | null): HTMLElement | null {
	if (!anchor) return null;
	const rootNode = anchor.getRootNode();
	if (rootNode && "host" in rootNode) {
		return (rootNode as ShadowRoot).host as HTMLElement;
	}
	return anchor.parentElement as HTMLElement | null;
}

type ContextProviderLikeEvent = Event & {
	context?: unknown;
};

function connectConsumerWithProviderRetry<T extends UnknownContext>(
	host: HTMLElement,
	context: T,
	onValue: (value: unknown) => void,
): () => void {
	let hasValue = false;
	const consumer = new ContextConsumer(host, {
		context,
		subscribe: true,
		onValue: (value) => {
			hasValue = true;
			onValue(value);
		},
	});
	consumer.connect();

	const onContextProvider = (event: ContextProviderLikeEvent) => {
		if (event.context !== context) return;
		consumer.requestValue();
	};
	host.addEventListener("context-provider", onContextProvider);

	let attempts = 0;
	const maxAttempts = 200;
	const retryTimer = globalThis.setInterval(() => {
		if (hasValue || attempts >= maxAttempts) {
			globalThis.clearInterval(retryTimer);
			return;
		}
		attempts += 1;
		consumer.requestValue();
	}, 50);

	return () => {
		globalThis.clearInterval(retryTimer);
		host.removeEventListener("context-provider", onContextProvider);
		consumer.disconnect();
	};
}

export function connectSectionPlayerCardRenderContext(
	host: HTMLElement,
	onValue: (value: SectionPlayerCardRenderContext) => void,
): () => void {
	return connectConsumerWithProviderRetry(
		host,
		sectionPlayerCardRenderContext,
		onValue as (value: unknown) => void,
	);
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
		setValue: (value: SectionPlayerCardRenderContext) => provider.setValue(value),
		disconnect: () => {
			root.detach();
			provider.disconnect();
		},
	};
}
