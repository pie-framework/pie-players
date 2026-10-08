/**
 * Cross-Custom-Element context for the section runtime engine.
 *
 * The toolkit CE renders inside its own Shadow DOM, so Svelte's native
 * `setContext`/`getContext` cannot carry the kernel's engine to the
 * toolkit's component tree. This module exposes a `@pie-players/pie-context`
 * based context that crosses the CE boundary via DOM events:
 *
 *   - The kernel (`SectionPlayerLayoutKernel.svelte`) installs a
 *     `ContextProvider` for `sectionRuntimeEngineHostContext` on its
 *     `host` (the layout CE). The provider value carries a narrow
 *     lifecycle handle for the engine owned by that kernel mount.
 *   - The toolkit CE installs a `ContextConsumer` on its own host. When
 *     wrapped by a section player layout, the consumer resolves to the
 *     kernel's lifecycle handle and suppresses its standalone lifecycle
 *     DOM emits in favor of the section-player host. Controller-side
 *     calls (`register`, `handleContent*`, `initialize`, etc.) remain
 *     owned by the toolkit's locally-constructed engine. When
 *     standalone, no host provider responds and the toolkit keeps using
 *     its standalone lifecycle path.
 *
 * The value carries only data that is safe to share across CE boundaries
 * (a stable lifecycle handle), never the engine itself.
 *
 * **Stability.** This export is part of the stable runtime/engine
 * surface; the symbol identity and value shape are part of the
 * cross-CE contract. Renaming or replacing the symbol is a major
 * breaking change. Adding optional fields to the value shape is
 * allowed; required fields are not.
 */

import {
	connectContextWithRetry,
	createContext,
} from "@pie-players/pie-context";

/**
 * Narrow cross-CE handle published by section-player. Deliberately omits
 * controller-facing methods (`initialize`, `register`, `handleContent*`,
 * etc.) so the package seam cannot grow an accidental controller contract.
 */
export interface SectionRuntimeLifecycleHandle {
	getRuntimeId(): string;
}

/**
 * Value shape published by the kernel and consumed by the wrapped
 * toolkit CE. Carries only the lifecycle handle today; if more cross-CE
 * shared runtime state is needed later, fields can be added here
 * additively.
 */
export interface SectionRuntimeEngineHostContextValue {
	engine: SectionRuntimeLifecycleHandle;
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

/**
 * Connect a DOM host to the cross-CE engine context through
 * `connectContextWithRetry`, as the toolkit's other contexts connect: a
 * provider that connects later answers through the document's context root.
 *
 * Returns a cleanup function that disconnects the consumer. A standalone
 * toolkit is never answered and keeps using its local engine — that is by
 * design and is not an error.
 */
export function connectSectionRuntimeEngineHostContext(
	host: HTMLElement,
	onValue: SectionRuntimeEngineHostContextListener,
): () => void {
	return connectContextWithRetry(
		host,
		sectionRuntimeEngineHostContext,
		onValue,
	);
}
