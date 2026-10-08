/**
 * An element holding `text`, attached to `doc`, for a test to read aloud. Pass
 * the registered document when a test swaps `globalThis.document` for a stub.
 */
export const contentWith = (
	text: string,
	doc: Document = document,
): Element => {
	const element = doc.createElement("div");
	element.textContent = text;
	doc.body.append(element);
	return element;
};
