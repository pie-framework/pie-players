import type {
	SectionPlayerCardTitleContext,
	SectionPlayerCardTitleFormatter,
} from "../../contracts/card-title-formatters.js";

export type ResolvedCardTitle = {
	text: string;
	visible: boolean;
};

/**
 * The title a card renders for a host's `hooks.cardTitleFormatter` return.
 *
 * Hiding takes an explicit `{ visible: false }`, the shape a tool context
 * resolver hides a tool with, because `null`, `undefined` and an empty string
 * already mean "keep the default": a host computing its title from data it may
 * lack returns one of them, and that host must keep getting "Question N".
 *
 * A hidden title keeps its text. The heading stays in the outline, visually
 * hidden: it is the card's name for assistive technology, and item content
 * nests its own headings one level below it.
 */
export function resolveCardTitle(
	formatter: SectionPlayerCardTitleFormatter | null | undefined,
	context: SectionPlayerCardTitleContext,
): ResolvedCardTitle {
	const fallback = { text: context.defaultTitle, visible: true };
	if (!formatter) return fallback;
	let result: unknown;
	try {
		result = formatter(context);
	} catch {
		return fallback;
	}
	if (typeof result === "string") {
		const text = result.trim();
		return text ? { text, visible: true } : fallback;
	}
	if (
		result !== null &&
		typeof result === "object" &&
		(result as { visible?: unknown }).visible === false
	) {
		return { text: context.defaultTitle, visible: false };
	}
	return fallback;
}
