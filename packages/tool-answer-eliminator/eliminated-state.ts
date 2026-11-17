import type { ChoiceTarget } from "./choice-targets.js";

/** Interface-locale wording the eliminated state is announced with. */
export interface EliminationChrome {
	/** Announced after an eliminated choice's label. */
	eliminatedText: string;
	/** Stamps the interface `lang` and `dir` on the announcement. */
	stamp(element: Element): void;
}

/** On the container while the choice is eliminated: the hook hosts style. */
export const ELIMINATED_ATTR = "data-pie-answer-eliminated";
const ANNOUNCEMENT_CLASS = "pie-answer-eliminator-sr-announcement";

type MarkedParts = Pick<ChoiceTarget, "container" | "content">;

function findAnnouncement(content: Element): Element | null {
	for (const child of content.children) {
		if (child.classList.contains(ANNOUNCEMENT_CLASS)) return child;
	}
	return null;
}

function labelAnnouncement(
	announcement: Element,
	chrome: EliminationChrome,
): void {
	// The leading space separates it from the label text it follows; the stamp's
	// `dir` isolates it from that text's direction. Unchanged text is not
	// rewritten: every write is a mutation the core observes.
	const text = ` ${chrome.eliminatedText}`;
	if (announcement.textContent !== text) announcement.textContent = text;
	chrome.stamp(announcement);
}

/**
 * Marks a choice eliminated, whatever strategy paints it. The container takes
 * the attribute and the content the announcement read after its label. The
 * container is never `aria-disabled`: it holds the toggle that restores the
 * choice. The element blocks selection itself, through `setEliminated`.
 */
export function markEliminated(
	{ container, content }: MarkedParts,
	chrome: EliminationChrome,
): void {
	if (container.getAttribute(ELIMINATED_ATTR) !== "true") {
		container.setAttribute(ELIMINATED_ATTR, "true");
	}
	const existing = findAnnouncement(content);
	if (existing) {
		labelAnnouncement(existing, chrome);
		return;
	}
	const announcement = document.createElement("span");
	announcement.className = ANNOUNCEMENT_CLASS;
	labelAnnouncement(announcement, chrome);
	content.appendChild(announcement);
}

export function clearEliminated({ container, content }: MarkedParts): void {
	if (container.hasAttribute(ELIMINATED_ATTR)) {
		container.removeAttribute(ELIMINATED_ATTR);
	}
	findAnnouncement(content)?.remove();
}

/** Relabels a marked choice's announcement in place, for a locale change. */
export function relabelEliminated(
	{ content }: MarkedParts,
	chrome: EliminationChrome,
): void {
	const announcement = findAnnouncement(content);
	if (announcement) labelAnnouncement(announcement, chrome);
}
