/**
 * One overlay element per coordinator and scoped tool id, reused across renders.
 *
 * The toolbar re-derives its rendered tools whenever an input moves — a policy
 * emit, a tool-config update, the interface locale — and mounts whichever
 * element each render returns, swapping out one it has not seen. A registration
 * that creates its overlay on every render therefore remounts it, and the
 * learner loses the ruler's position, the graph's points or the eliminated
 * choices while the tool stays open. Reusing the element keeps the mount a
 * no-op, so per-render attributes are the registration's to re-apply.
 *
 * A Svelte custom element tears its component down once it leaves the document,
 * so a cached element found disconnected is dropped and recreated.
 */

import type {
	ToolCoordinatorApi,
	ToolbarContext,
} from "@pie-players/pie-assessment-toolkit/tools/internal";
import { TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP } from "./tts.js";

const overlayElements = new WeakMap<
	ToolCoordinatorApi,
	Map<string, HTMLElement>
>();

/**
 * The element cached for `fullToolId` under this toolbar's coordinator, or the
 * one `create` returns, which is then cached. Without a coordinator there is no
 * session to key by, and every render creates.
 */
export function resolveOverlayElement<T extends HTMLElement>(
	toolbarContext: ToolbarContext,
	fullToolId: string,
	create: () => T,
): T {
	const coordinator = toolbarContext.toolCoordinator;
	if (!coordinator) return create();
	let scoped = overlayElements.get(coordinator);
	const cached = scoped?.get(fullToolId);
	if (cached?.isConnected) return cached as T;
	const element = create();
	if (!scoped) {
		scoped = new Map();
		overlayElements.set(coordinator, scoped);
	}
	scoped.set(fullToolId, element);
	// The toolbar calls this as it unmounts the element, before detaching it, so
	// the check waits a microtask: an element another toolbar has adopted in the
	// meantime is still connected and stays cached.
	(element as unknown as Record<string, unknown>)[
		TOOL_ELEMENT_UNMOUNT_CALLBACK_PROP
	] = () => {
		queueMicrotask(() => {
			if (!element.isConnected && scoped.get(fullToolId) === element) {
				scoped.delete(fullToolId);
			}
		});
	};
	return element;
}
