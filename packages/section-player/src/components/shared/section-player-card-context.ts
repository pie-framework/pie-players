import { ContextConsumer, createContext } from "@pie-players/pie-context";
import type { UnknownContext } from "@pie-players/pie-context";
import type { PlayerElementParams } from "./player-action.js";

export type SectionPlayerCardRenderContext = {
	resolvedPlayerTag: string;
	playerAction: (node: HTMLElement, params: PlayerElementParams) => unknown;
};

export const sectionPlayerCardRenderContext = createContext<SectionPlayerCardRenderContext>(
	Symbol.for("@pie-players/pie-section-player/card-render-context"),
);

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
