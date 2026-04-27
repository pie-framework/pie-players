/**
 * Cross-Custom-Element context for the section runtime engine (M7 PR 6).
 *
 * The toolkit CE renders inside its own Shadow DOM, so Svelte's native
 * `setContext`/`getContext` (used by `engine-context.ts`) cannot bridge
 * the kernel-provided engine reference to the toolkit's component tree.
 * This module exposes a `@pie-players/pie-context` based context that
 * does cross the CE boundary via DOM events:
 *
 *   - The kernel (`SectionPlayerLayoutKernel.svelte`) installs a
 *     `ContextProvider` for `sectionRuntimeEngineHostContext` on its
 *     `host` (the layout CE). The provider value carries the engine
 *     reference owned by that kernel mount.
 *   - The toolkit CE installs a `ContextConsumer` on its own host. When
 *     wrapped by a section player layout, the consumer resolves to the
 *     kernel's engine and the toolkit treats it as the active engine
 *     for legacy controller-side calls (`register`, `handleContent*`,
 *     `initialize`, etc.) and for FSM input dispatch (e.g.
 *     `framework-error`). When standalone, no upstream provider
 *     responds and the toolkit keeps using its locally-constructed
 *     engine.
 *
 * The two engine-context surfaces (`SECTION_RUNTIME_ENGINE_KEY` and
 * this one) are deliberately distinct:
 *   - `SECTION_RUNTIME_ENGINE_KEY` (Svelte context) stays scoped to a
 *     single component tree (kernel + descendants in the same shadow
 *     root) and is the right hook for in-tree consumers.
 *   - `sectionRuntimeEngineHostContext` (DOM-event context) is the
 *     bridge for cross-CE consumers and only carries data that is
 *     safe to share across CE boundaries (a stable engine reference).
 *
 * **Stability.** This export is part of the stable runtime/engine
 * surface; the symbol identity and value shape are part of the
 * cross-CE contract. Renaming or replacing the symbol is a major
 * breaking change. Adding optional fields to the value shape is
 * allowed; required fields are not.
 */

import {
	ContextConsumer,
	createContext,
	type UnknownContext,
} from "@pie-players/pie-context";
import type { SectionRuntimeEngine } from "./SectionRuntimeEngine.js";

/**
 * Value shape published by the kernel and consumed by the wrapped
 * toolkit CE. Carries only the engine reference today; if more
 * cross-CE shared runtime state is needed later, fields can be added
 * here additively.
 */
export interface SectionRuntimeEngineHostContextValue {
	engine: SectionRuntimeEngine;
}

/**
 * `pie-context` context key for the cross-CE engine bridge. Uses a
 * `Symbol.for(...)` registry key so providers and consumers in
 * separately-bundled CEs see the same identity.
 */
export const sectionRuntimeEngineHostContext =
	createContext<SectionRuntimeEngineHostContextValue>(
		Symbol.for("pie.sectionRuntimeEngineHostContext"),
	);

export type SectionRuntimeEngineHostContextListener = (
	value: SectionRuntimeEngineHostContextValue,
) => void;

type ContextProviderLikeEvent = Event & {
	context?: unknown;
};

/**
 * Connect a DOM host to the cross-CE engine context with the same
 * provider-retry semantics used elsewhere in the toolkit (initial
 * synchronous request + `context-provider` re-request + 50 ms polling
 * fallback up to 200 attempts ≈ 10 s).
 *
 * The retry mirrors the existing
 * `connectAssessmentToolkitHostRuntimeContext` infrastructure so the
 * timing characteristics of cross-CE handshakes stay consistent across
 * the toolkit's contexts.
 *
 * Returns a cleanup function that disconnects the consumer and clears
 * the retry interval. Standalone toolkits naturally exhaust the retry
 * window without ever resolving and continue using their local
 * engine — that is by design and is not an error.
 */
export function connectSectionRuntimeEngineHostContext(
	host: HTMLElement,
	onValue: SectionRuntimeEngineHostContextListener,
): () => void {
	let hasValue = false;
	const consumer = new ContextConsumer(host, {
		context: sectionRuntimeEngineHostContext,
		subscribe: true,
		onValue: (value) => {
			hasValue = true;
			onValue(value);
		},
	});
	consumer.connect();

	const onContextProvider = (event: ContextProviderLikeEvent) => {
		if (
			event.context !==
			(sectionRuntimeEngineHostContext as unknown as UnknownContext)
		) {
			return;
		}
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
