const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Rewrite exact authored custom-element tags to their authoring-mode variants.
 * Tag names are escaped because valid custom-element names may contain regexp
 * metacharacters such as dots.
 */
export function transformMarkupForAuthoring(
	markup: string,
	elements: Record<string, string>,
): string {
	return Object.keys(elements).reduce((result, elementTag) => {
		const exactTag = new RegExp(
			`(<\\/?)${escapeRegExp(elementTag)}(?=[\\t\\n\\f\\r />])`,
			"g",
		);
		return result.replace(
			exactTag,
			(_match, opening: string) => `${opening}${elementTag}-config`,
		);
	}, markup);
}
